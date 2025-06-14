import { Plugin } from '@bellatrix/core/infrastructure';
import { SuiteMetadata, TestMetadata } from '@bellatrix/core/test/props';
import { BellatrixSettings } from '@bellatrix/core/settings';
import { CbReporterClient } from './CbReporterClient';
import { WebComponentHooks } from '@bellatrix/web/components/utilities';
import {
    Anchor,
    Button,
    CheckBox,
    ColorInput,
    DateInput,
    DateTimeInput,
    EmailField,
    FileInput,
    MonthInput,
    NumberInput,
    PasswordField,
    PhoneField,
    RangeInput,
    SearchField,
    Select,
    TextArea,
    TextField,
    TimeInput,
    UrlField,
    WebComponent,
    WeekInput
} from '@bellatrix/web/components';

export class CloudBeatPlugin extends Plugin {
    private readonly pluginSettings?: CloudBeatPluginSettings;
    private readonly reporterClient?: CbReporterClient;
    private readonly isActive = typeof process.env.CB_AGENT === 'string' && process.env.CB_AGENT.toLowerCase() === 'true';

    constructor() {
        super();
        this.pluginSettings = BellatrixSettings.get().cloudbeatPluginSettings;
        if (this.isActive) {
            this._handleComponentEvents();
            this.reporterClient = new CbReporterClient();
            this.reporterClient.connect();
        }
    }
    override async preBeforeSuite(suiteMetadata: SuiteMetadata): Promise<void> {
        if (!this.isActive) {
            return;
        }
        await this.reporterClient?.awaitForConnection();
        this.reporterClient?.onSuiteStart(suiteMetadata);
    }
    override async preAfterSuite(suiteMetadata: SuiteMetadata): Promise<void> {
        if (!this.isActive) {
            return;
        }
        await this.reporterClient?.awaitForConnection();
        this.reporterClient?.onSuiteEnd(suiteMetadata);
    }
    override async preBeforeTest(metadata: TestMetadata): Promise<void> {
        if (!this.isActive) {
            return;
        }
        this.reporterClient?.onCaseStart(metadata);
    }
    override async preAfterTest(metadata: TestMetadata): Promise<void> {
        if (!this.isActive) {
            return;
        }
        // FIXME: how we determine if the test has finished with an error?!
        // metadata.error suppose to contain error object on failed test, but it's empty
        this.reporterClient?.onCaseEnd(metadata);
    }
    private onStepStart(stepName: string) {
        this.reporterClient?.onStepStart(stepName);
    }
    private onStepEnd(stepName: string) {
        this.reporterClient?.onStepEnd(stepName);
    }
    private _handleComponentEvents() {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        WebComponentHooks.addListenerTo(Anchor).before('click', function() { self.onStepStart(`clicking ${this.componentName}`); });
        WebComponentHooks.addListenerTo(Anchor).after('click', function() { self.onStepEnd(`clicking ${this.componentName}`); });

        WebComponentHooks.addListenerTo(Button).before('click', function() { self.onStepStart(`clicking ${this.componentName}`); });
        WebComponentHooks.addListenerTo(Button).after('click', function() { self.onStepEnd(`clicking ${this.componentName}`); });

        WebComponentHooks.addListenerTo(ColorInput).before('setColor', function(color) { self.onStepStart(`setting '${color}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(ColorInput).after('setColor', function(color) { self.onStepEnd(`setting '${color}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(CheckBox).before('check', function() { self.onStepStart(`checking ${this.componentName}`); });
        WebComponentHooks.addListenerTo(CheckBox).after('check', function() { self.onStepEnd(`checking ${this.componentName}`); });

        WebComponentHooks.addListenerTo(CheckBox).before('uncheck', function() { self.onStepStart(`unchecking ${this.componentName}`); });
        WebComponentHooks.addListenerTo(CheckBox).after('uncheck', function() { self.onStepEnd(`unchecking ${this.componentName}`); });

        WebComponentHooks.addListenerTo(DateInput).before('setDate', function(date) { self.onStepStart(`setting ${this.componentName} to ${date.toLocaleDateString(locale)}`); });
        WebComponentHooks.addListenerTo(DateInput).after('setDate', function(date) { self.onStepEnd(`setting ${this.componentName} to ${date.toLocaleDateString(locale)}`); });

        WebComponentHooks.addListenerTo(DateTimeInput).before('setTime', function(dateTime) { self.onStepStart(`setting ${this.componentName} to ${dateTime.toLocaleString()}`); });
        WebComponentHooks.addListenerTo(DateTimeInput).after('setTime', function(dateTime) { self.onStepEnd(`setting ${this.componentName} to ${dateTime.toLocaleString()}`); });

        WebComponentHooks.addListenerTo(EmailField).before('setEmail', function(email) { self.onStepStart(`typing '${email}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(EmailField).after('setEmail', function(email) { self.onStepEnd(`typing '${email}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(FileInput).before('upload', function(filePath) { self.onStepStart(`uploading '${filePath}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(FileInput).after('upload', function(filePath) { self.onStepEnd(`uploading '${filePath}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(MonthInput).before('setMonth', function(year, month) { self.onStepStart(`setting ${this.componentName} to ${new Date(year, month - 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`); });
        WebComponentHooks.addListenerTo(MonthInput).after('setMonth', function(year, month) { self.onStepEnd(`setting ${this.componentName} to ${new Date(year, month - 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`); });

        WebComponentHooks.addListenerTo(NumberInput).before('setNumber', function(number) { self.onStepStart(`setting ${this.componentName} to ${number}`); });
        WebComponentHooks.addListenerTo(NumberInput).after('setNumber', function(number) { self.onStepEnd(`setting ${this.componentName} to ${number}`); });

        WebComponentHooks.addListenerTo(PasswordField).before('setPassword', function() { self.onStepStart(`typing '********' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(PasswordField).after('setPassword', function() { self.onStepEnd(`typing '********' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(PhoneField).before('setPhone', function(phone) { self.onStepStart(`typing '${phone}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(PhoneField).after('setPhone', function(phone) { self.onStepEnd(`typing '${phone}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(RangeInput).before('setValue', function(value) { self.onStepStart(`setting ${this.componentName} to ${value}`); });
        WebComponentHooks.addListenerTo(RangeInput).after('setValue', function(value) { self.onStepEnd(`setting ${this.componentName} to ${value}`); });

        WebComponentHooks.addListenerTo(SearchField).before('setSearch', function(search) { self.onStepStart(`typing '${search}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(SearchField).after('setSearch', function(search) { self.onStepEnd(`typing '${search}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(Select).before('selectByText', function(text) { self.onStepStart(`selecting '${text}' from ${this.componentName}`); });
        WebComponentHooks.addListenerTo(Select).after('selectByText', function(text) { self.onStepEnd(`selecting '${text}' from ${this.componentName}`); });

        WebComponentHooks.addListenerTo(Select).before('selectByIndex', function(index) { self.onStepStart(`selecting index ${index} from ${this.componentName}`); });
        WebComponentHooks.addListenerTo(Select).after('selectByIndex', function(index) { self.onStepEnd(`selecting index ${index} from ${this.componentName}`); });

        WebComponentHooks.addListenerTo(Select).before('selectByValue', function(value) { self.onStepStart(`selecting value="${value}" from ${this.componentName}`); });
        WebComponentHooks.addListenerTo(Select).after('selectByValue', function(value) { self.onStepEnd(`selecting value="${value}" from ${this.componentName}`); });

        WebComponentHooks.addListenerTo(TextArea).before('setText', function(text) { self.onStepStart(`typing '${text}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(TextArea).after('setText', function(text) { self.onStepEnd(`typing '${text}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(TextField).before('setText', function(text) { self.onStepStart(`typing '${text}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(TextField).after('setText', function(text) { self.onStepEnd(`typing '${text}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(TimeInput).before('setTime', function(hours, minutes, seconds) { self.onStepStart(`setting ${this.componentName} to ${[hours, minutes, seconds].map(n => String(n ?? 0).padStart(2, '0')).join(':')}`); });
        WebComponentHooks.addListenerTo(TimeInput).after('setTime', function(hours, minutes, seconds) { self.onStepEnd(`setting ${this.componentName} to ${[hours, minutes, seconds].map(n => String(n ?? 0).padStart(2, '0')).join(':')}`); });

        WebComponentHooks.addListenerTo(UrlField).before('setUrl', function(url) { self.onStepStart(`typing '${url}' into ${this.componentName}`); });
        WebComponentHooks.addListenerTo(UrlField).after('setUrl', function(url) { self.onStepEnd(`typing '${url}' into ${this.componentName}`); });

        WebComponentHooks.addListenerTo(WeekInput).before('setWeek', function(year, weekNumber) { self.onStepStart(`setting ${this.componentName} to ${year}-W${weekNumber.toString().padStart(2, '0')}`); });
        WebComponentHooks.addListenerTo(WeekInput).after('setWeek', function(year, weekNumber) { self.onStepEnd(`setting ${this.componentName} to ${year}-W${weekNumber.toString().padStart(2, '0')}`); });

        WebComponentHooks.addListenerTo(WebComponent).before('scrollIntoView', function() { self.onStepStart(`scrolling ${this.componentName} into view`); });
        WebComponentHooks.addListenerTo(WebComponent).after('scrollIntoView', function() { self.onStepEnd(`scrolling ${this.componentName} into view`); });

        WebComponentHooks.addListenerTo(WebComponent).before('hover', function() { self.onStepStart(`hovering ${this.componentName}`); });
        WebComponentHooks.addListenerTo(WebComponent).after('hover', function() { self.onStepEnd(`hovering ${this.componentName}`); });

        WebComponentHooks.addListenerTo(WebComponent).before('focus', function() { self.onStepStart(`focusing ${this.componentName}`); });
        WebComponentHooks.addListenerTo(WebComponent).after('focus', function() { self.onStepEnd(`focusing ${this.componentName}`); });
    }
}

declare module '@bellatrix/core/types' {
    interface BellatrixConfiguration {
        cloudbeatPluginSettings?: CloudBeatPluginSettings;
    }
}

interface CloudBeatPluginSettings {
    isPluginEnabled: boolean;
    projectId: string,
}
