import { SuiteMetadata, TestMetadata } from '@bellatrix/core/test/props';
import { io, Socket } from 'socket.io-client';
import Queue from 'js-queue';
import { SuiteResult, CaseResult, StepResult, ResultStatusEnum } from '@cloudbeat/types';
import { v4 as uuidv4 } from 'uuid';

export class CbReporterClient  {
    private socket?: Socket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queue?: any;
    private connectPromiseResolve?: (value: unknown) => void;
    private connectPromise?: Promise<unknown>;
    private suiteMap: Map<string, SuiteResult> = new Map();
    // FIXME: the below solution is not parallel-execution safe
    private currentTestCase?: CaseResult;

    constructor() {
    }

    connect() {
        this.queue = new Queue();
        this.queue.stop = false;
        this.queue.autoRun = true;

        this.socket = io(
            `ws://localhost:${  process.env.CB_REPORT_SERVER_PORT || 3001}`,
            {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 500,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 10,
            },
        );
        const promise = new Promise((resolve, reject) => {
            this.connectPromiseResolve = resolve;
        });
        this.handleSocketEvents();
        this.connectPromise = promise;
    }

    async awaitForConnection() {
        if (this.connectPromise) {
            await this.connectPromise;
        }
    }

    onRunStart(): void {
        // FIXME: Bellatrix is missing global run start and run end hooks
        // this.queue.add(this.getEventEmitter('run:start', {}));
    }
    onRunEnd(): void {
        // FIXME: Bellatrix is missing global run start and run end hooks
        // this.queue.add(this.getEventEmitter('run:end', {}));
    }

    onSuiteStart(suiteMetadata: SuiteMetadata): void {
        const { suiteName } = suiteMetadata;
        // We assume the same suite (e.g. test file) will not be executed twice
        if (this.suiteMap.has(suiteName)) {
            return;
        }
        const cbSuite: SuiteResult = {
            id: uuidv4(),
            name: suiteName,
            startTime: (new Date().getTime()),
            fqn: suiteName,     // TODO: if possible, make FQN a relative path including the containing folder
            iterationNum: 1,
            location: `${suiteName}.ts`,
            testAttributes: {},
            status: ResultStatusEnum.PASSED,
            suites: [],
            cases: [],
            hooks: [],
        };
        this.suiteMap.set(suiteName, cbSuite);
        this.queue.add(this.getEventEmitter('suite:start', suiteName));
    }
    onSuiteEnd(suiteMetadata: SuiteMetadata): void {
        const { suiteName } = suiteMetadata;
        // We assume the same suite (e.g. test file) will not be executed twice
        if (!this.suiteMap.has(suiteName)) {
            return;
        }
        const startedCbSuite = this.suiteMap.get(suiteName)!;
        startedCbSuite.endTime = (new Date().getTime());
        startedCbSuite.duration = startedCbSuite.endTime - startedCbSuite.startTime;
        startedCbSuite.status = this.determineSuiteStatus(startedCbSuite);
        this.queue.add(this.getEventEmitter('suite:end', startedCbSuite));
    }
    onCaseStart(testMetadata: TestMetadata): void {
        const { suiteName, testName, customData } = testMetadata;
        if (!this.suiteMap.has(suiteName)) {
            return;
        }
        const cbSuite = this.suiteMap.get(suiteName);
        const newCbCase: CaseResult = {
            id: uuidv4(),
            name: testName,
            startTime: (new Date().getTime()),
            fqn: `${suiteName}#${testName}`,
            iterationNum: 1,
            location: undefined,    // TODO: is it possible to determine start line of test method function
            steps: [],
            testAttributes: customData,
        };
        this.currentTestCase = newCbCase;
        cbSuite!.cases.push(newCbCase);
        this.queue.add(this.getEventEmitter('case:start', newCbCase));
    }
    onCaseEnd(testMetadata: TestMetadata): void {
        const { suiteName, testName, customData, error } = testMetadata;
        if (!this.suiteMap.has(suiteName)) {
            return;
        }
        const cbSuite = this.suiteMap.get(suiteName);
        const startedCbCase = cbSuite!.cases.find((x: CaseResult) => x.name === testName && !x.endTime);
        if (!startedCbCase) {
            return;
        }
        // We could use this.currentTestCase to get the test case, but this is not safe
        // if we have same test name in multiple suites
        this.currentTestCase = undefined;
        startedCbCase.endTime = (new Date().getTime());
        startedCbCase.duration = startedCbCase.endTime - startedCbCase.startTime;
        if (error) {
            startedCbCase.status = ResultStatusEnum.FAILED;
            startedCbCase.failure = this.getCbFailureFromError(error);
        }
        else {
            startedCbCase.status = ResultStatusEnum.PASSED;
        }
        if (customData) {
            startedCbCase.testAttributes = {...(startedCbCase.testAttributes || {}), ...customData};
        }
        this.queue.add(this.getEventEmitter('case:end', testMetadata));
    }

    // TODO: We need to convert multiple Bellatrix components events to corresponding CB step reports
    onStepStart(stepName: string): void {
        if (!this.currentTestCase) {
            return;
        }
        const newCbStep: StepResult = {
            id: uuidv4(),
            name: stepName,
            startTime: (new Date().getTime()),
        };
        this.currentTestCase.steps?.push(newCbStep);
    }

    onStepEnd(stepName: string): void {
        if (!this.currentTestCase) {
            return;
        }
        const startedStep = this.currentTestCase.steps?.find(s => s.name === stepName && !s.endTime);
        if (!startedStep) {
            return;
        }
        startedStep.endTime = (new Date().getTime());
        startedStep.duration = startedStep.endTime - startedStep.startTime!;
        startedStep.status = ResultStatusEnum.PASSED;
    }

    private handleSocketEvents() {
        if (!this.socket) {
            return;
        }

        this.socket.io.on('error', (err: unknown) => {
            console.error('WS client error:', err);
            this.queue.stop = true;
        });

        this.socket.on('connect', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            this.connectPromiseResolve && this.connectPromiseResolve(undefined);
            this.connectPromiseResolve = undefined;
            this.connectPromise = undefined;
            this.queue.stop = false;
            this.queue.next();
        });

        this.socket.on('error', (err: any) => {
            console.error('WS client error:', err.message);
        });

        this.socket.on('disconnect', () => {
            this.queue.stop = true;
        });
    }

    private getEventEmitter(eventName: string, payload: unknown): unknown {
        return () => {
            try {
                this.socket?.emit(eventName, payload, () => this.queue.next());
            }
            catch (e) {
                console.log('CbReporterClient error:', e);
            }
        };
    }

    private determineSuiteStatus(suiteResult: SuiteResult) {
        const hasFailedCases = suiteResult.cases.some((c: CaseResult) => c.status === ResultStatusEnum.FAILED);
        return hasFailedCases ? ResultStatusEnum.FAILED : ResultStatusEnum.PASSED;
    }

    private getCbFailureFromError(error: Error) {
        return {
            type: this.getCbFailureTypeForError(error),
            subtype: error.constructor.name,
            message: error.message,
            stacktrace: error.stack,
        };
    }

    private getCbFailureTypeForError(error: Error): string {
        if (error.constructor.name === 'BellatrixAssertionError') {
            return 'ASSERT_ERROR';
        }
        return 'GENERAL_ERROR';
    }
}
