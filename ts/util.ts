import * as cp from 'child_process';

/**
  * Function that execute command (used to communicate with cli)
  * @method executeChildProcess
  * @param {string} command Command to execute
  * @param {string} workingDirectory Working directory of process
  * @returns {Promise<string>} Returns stdout
  */
export function executeChildProcess(command: string, workingDirectory: string = null): Promise<string> {
    // TODO: Return ChildProcess in order to stop it when needed
    let promise = new Promise((resolve, reject) => {
        // TODO: Use spawn and buffers.
        cp.exec(command, { cwd: workingDirectory, maxBuffer: 1024 * 1024 * 500 }, function (error, stdout, stderr) {
            let execError = stderr.toString();
            if (error) {
                reject(new Error(error.message));
            } else if (execError !== '') {
                reject(new Error(execError));
            } else {
                resolve(stdout);
            }
        });
    });

    return promise;
}

/**
  * Class that caches values
  * @class Cacheable
  */
export class Cacheable {
    private value: {} = null;
    private action: () => Promise<{}>;
    constructor(action: () => Promise<{}>) {
        this.action = action;
    }
    getValue(): Promise<{}> {
        let that = this;
        let promise = new Promise((resolve, reject) => {
            if (that.value == null) {
                that.action().then(value => {
                    that.value = value;
                    resolve(that.value);
                }).catch(error => reject(error));
            } else {
                resolve(that.value);
            }
        });
        return promise;
    }
}
