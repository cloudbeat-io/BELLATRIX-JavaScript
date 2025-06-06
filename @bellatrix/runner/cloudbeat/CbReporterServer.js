const socketIOPath = new URL(import.meta.resolve('socket.io')).pathname;
const SocketIO = await import(socketIOPath);
const { Server } = SocketIO;

// "fs" module
const fsModulePath = new URL(import.meta.resolve('fs')).pathname;
const fs = await import(fsModulePath);

// "path" module
const pathModulePath = new URL(import.meta.resolve('path')).pathname;
const path = await import(pathModulePath);

const CB_RESULT_FILE_NAME = '.CB_TEST_RESULTS.json';

const io = new Server({
    serveClient: false,
    pingInterval: 10000,
    pingTimeout: 60000,
    maxHttpBufferSize: 256 * 1024 * 1024, // 256MB
    cookie: true,
    cors: {
        origin: '*',
    },
    // allowUpgrades: false,
    transports: ['websocket'],
});

export default class CbReporterServer {
    constructor(cwd) {
        this.cwd = cwd;
        this.cbRunId = process.env.CB_RUN_ID;
        this.cbInstanceId = process.env.CB_INSTANCE_ID;
        this.cbAgentId = process.env.CB_AGENT_ID;
    }

    init(reportServerPort = 3001) {
        io.listen(reportServerPort);
        this._handleServerEvents();
    }

    start() {
        this.runResult = {
            startTime: (new Date()).getTime(),
            runId: this.cbRunId,
            instanceId: this.cbInstanceId,
            agentId: this.agentId,
            totalCases: this.allCasesCount,
            metadata: {
                framework: 'Bellatrix',
                language: 'TypeScript',
            },
            capabilities: {},   // TODO: gather browserName and other test run attributes
            suites: [],
        };
    }

    stop() {
        try {
            io.close();
        }
        catch {}
        if (!this.runResult) {
            return;
        }
        this.runResult.endTime = (new Date()).getTime();
        this.runResult.duration = this.runResult.endTime - this.runResult.startTime;
        this.runResult.status = 'PASSED';   // FIXME: add function that determines run status
        try {
            fs.writeFileSync(path.join(this.cwd, CB_RESULT_FILE_NAME), JSON.stringify(this.runResult, null, 4));
        }
        catch (e) {
            console.warn('CloudBeat is unable to write the result file: ', e);
        }
    }

    _handleServerEvents() {
        io.on('connection', (socket) => {
            this._handleSocketEvents(socket);
        });
        io.on('error', (err) => {
            console.error('WS server error:', err.message);
        });
    }

    _handleSocketEvents(socket) {
        socket.on('connect_error', (err) => {
            console.error('WS server error:', err.message);
        });
        socket.on('disconnect', (reason) => {
        });
        socket.on('error', (err) => {
            console.error('WS server error:', err);
        });
        socket.on('suite:start', (suiteResult, callback) => {
            callback();
        });
        socket.on('suite:end', (suiteResult, callback) => {
            this.runResult?.suites.push(suiteResult);
            callback();
        });
        socket.on('case:start', (metadata, callback) => {
            callback();
            // TODO: report test case progress
        });
        socket.on('case:end', (metadata, callback) => {
            callback();
            // TODO: report test case progress
        });
    }
}
