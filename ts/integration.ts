import { LinterhubCliLazy, LinterhubMode } from './linterhub-cli'
import { getDotnetVersion, install } from './linterhub-installer'
import { LinterVersionResult, LinterResult } from './types';

export enum Run {
    none,
    force,
    onStart,
    onOpen,
    onType,
    onSave
}

/**
  * Describes logger provider
  * @interface LoggerInterface
  */
export interface LoggerInterface {
    /**
      * Prints ordinary information
      * @method info
      * @param {string} log Text to print
      */
    info(log: string);

    /**
      * Prints errors
      * @method error
      * @param {string} log Text to print
      */
    error(log: string);

    /**
      * Prints warnings
      * @method warn
      * @param {string} log Text to print
      */
    warn(log: string);
}

/**
  * Describes status provider
  * @interface StatusInterface
  */
export interface StatusInterface {
    /**
      * Updates status string
      * @method update
      * @param {string} text New status
      */
    update(params: any, progress?: boolean, text?: string): void;
}

export interface Settings {
    linterhub: {
        enable: boolean;
        run: Run[];
        mode: LinterhubMode,
        cliPath: any;
    }
    [key: string]: any;
}

export abstract class Integration {
    protected systemId: string = "_system";
    protected abstract linterhub_version: string;
    protected linterhub: LinterhubCliLazy;
    protected project: string;
    protected abstract logger: LoggerInterface;
    protected abstract status: StatusInterface;

    protected onReady: Promise<{}>;

    protected abstract sendDiagnostics(data: string, document?: any): any[];

    protected abstract settings: any;

    protected initializeLinterhub() {
        this.linterhub = new LinterhubCliLazy(this.logger, this.settings.linterhub.cliPath, this.project, this.settings.linterhub.mode);
        this.onReady = this.linterhub.version();
        return this.onReady;
    }

    install(): Promise<string> {
        this.status.update({ id: this.systemId }, true);

        return getDotnetVersion()
            .then(() => { this.settings.linterhub.mode = LinterhubMode.dotnet; })
            .catch(() => { this.settings.linterhub.mode = LinterhubMode.native; })
            .then(() => { this.logger.info(`Start download.`); })
            .then(() => { this.logger.info(this.settings.linterhub.mode.toString()) })
            .then(() => {

                return install(this.settings.linterhub.mode, __dirname + '/../../', null, true, this.logger, this.status, this.linterhub_version)
                    .then((data) => {
                        this.logger.info(`Finish download.`);
                        this.initializeLinterhub();
                        return data;
                    })
                    .catch((reason) => {
                        this.logger.error(`Error catalog '${reason}.toString()'.`);
                        return [];
                    })
                    .then((result) => {
                        this.status.update({ id: this.systemId }, false);
                        return result;
                    });
            });

    }
    /**
     * Analyze project.
     *
     */
    analyze(): Promise<any> {
        return this.onReady
            .then(() => { this.logger.info(`Analyze project.`) })
            .then(() => { this.status.update({ id: this.project }, true) })
            .then(() => this.linterhub.analyze())
            .then((data: string) => { return this.sendDiagnostics(data) })
            .catch((reason) => { this.logger.error(`Error analyze project '${reason}.toString()'.`) })
            .then((data) => {
                this.status.update({ id: this.project }, false);
                this.logger.info(`Finish analyze project.`)
                return data;
            })
    }

    protected abstract normalizePath(path: string): string;
    /**
     * Analyze single file.
     *
     * @param path The relative path to file.
     * @param run The run mode (when).
     * @param document The active document.
     */
    analyzeFile(path: string, run: Run = Run.none, document: any = null): Promise<any> {
        if (this.settings.linterhub.run.indexOf(run) < 0) {
            return null;
        }

        if (document != null) {
            // TODO
        }

        return this.onReady
            .then(() => this.logger.info(`Analyze file '${path}'.`))
            .then(() => this.status.update({ id: path }, true))
            .then(() => this.linterhub.analyzeFile(this.normalizePath(path)))
            .then((data: string) => {
                return this.sendDiagnostics(data, document)
            })
            .catch((reason) => { this.logger.error(`Error analyze file '${reason}.toString()'.`) })
            .then((data) => {
                this.status.update({ id: path }, false)
                this.logger.info(`Finish analyze file '${path}'.`)
                return data;
            });
    }
    /**
     * Get linters catalog.
     *
     */
    catalog(): Promise<LinterResult[]> {
        return this.onReady
            .then(() => this.status.update({ id: this.systemId }, true))
            .then(() => this.linterhub.catalog())
            .then((data: string) => {
                let json: any = JSON.parse(data);
                this.logger.info(data);
                return json;
            })
            .catch((reason) => {
                this.logger.error(`Error catalog '${reason}.toString()'.`);
                return [];
            })
            .then((result) => {
                this.status.update({ id: this.systemId }, false);
                return result;
            });
    }
    /**
     * Activate linter.
     *
     * @param path The linter name.
     */
    activate(name: string): Promise<string> {
        return this.onReady
            .then(() => this.status.update({ id: this.systemId }, true))
            .then(() => this.linterhub.activate(name))
            .catch((reason) => { this.logger.error(`Error activate '${reason}.toString()'.`) })
            .then(() => this.status.update({ id: this.systemId }, false))
            .then(() => name);
    }
    /**
     * Get the linter version.
     *
     * @param path The linter name.
     */
    linterVersion(name: string, install: boolean): Promise<LinterVersionResult> {
        return this.onReady
            .then(() => this.status.update({ id: this.systemId }, true))
            .then(() => this.linterhub.linterVersion(name, install))
            .then((data: string) => {
                let json: LinterVersionResult = JSON.parse(data);
                this.logger.info(data);
                return json;
            })
            .catch((reason) => {
                this.logger.error(`Error while requesting linter version '${reason}.toString()'.`);
                return null;
            })
            .then((result) => {
                this.status.update({ id: this.systemId }, false);
                return result;
            });
    }

    /**
     * Deactivate linter.
     *
     * @param path The linter name.
     */
    deactivate(name: string): Promise<string> {
        return this.onReady
            .then(() => this.status.update({ id: this.systemId }, true))
            .then(() => this.linterhub.deactivate(name))
            .catch((reason) => { this.logger.error(`Error deactivate '${reason}.toString()'.`) })
            .then(() => this.status.update({ id: this.systemId }, false))
            .then(() => name);
    }

    version(): Promise<string> {
        return this.onReady
            .then(() => {
                return this.linterhub.version();
            })
            .catch((reason) => {
                this.logger.error(reason.toString());
            });
    }
}
