import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { parse as parseUrl } from 'url';
import { Proxy } from './proxy';
import { PlatformInformation } from './platform';
import { executeChildProcess } from './util';
import { LinterhubMode } from './linterhub-cli';
import { LoggerInterface, StatusInterface } from './integration';
import { mkdirp } from 'mkdirp';
import * as yauzl from 'yauzl';

/**
  * Class that provide information for downloading, installing and activating Linterhub
  * @class LinterhubPackage
  */
export class LinterhubPackage {
    readonly prefix: string = "https://github.com/Repometric/linterhub-cli/releases/download/";
    private version: string;
    private info: PlatformInformation;
    private native: boolean;
    private folder: string;
    constructor(info: PlatformInformation, folder: string, native: boolean, version: string) {
        this.info = info;
        this.native = native;
        this.folder = folder;
        this.version = version;
    }
    getPackageVersion(): string {
        return this.version;
    }
    getPackageName(): string {
        if (!this.native) {
            return "dotnet";
        }
        // TODO: Improve name conversion
        if (this.info.isMacOS()) {
            return "osx.10.11-x64";
        }
        if (this.info.isWindows()) {
            return "win10-x64";
        }
        if (this.info.isLinux()) {
            return "debian.8-x64";
        }
        return "unknown";
    }
    getPackageFullName(): string {
        return "linterhub-cli-" + this.getPackageName();
    }
    getPackageFileName(): string {
        return this.getPackageFullName() + ".zip";
    }
    getPackageFullFileName(): string {
        return path.join(this.folder, this.getPackageFileName());
    }
    getPackageUrl(): string {
        return this.prefix + this.version + "/" + this.getPackageFileName();
    }
}

/**
  * Class for downloading Linterhub
  * @class LinterhubPackage
  */
export class NetworkHelper {
    buildRequestOptions(urlString: any, proxy: string, strictSSL: boolean): https.RequestOptions {
        const url = parseUrl(urlString);
        const options: https.RequestOptions = {
            host: url.host,
            path: url.path,
            agent: Proxy.getProxyAgent(url, proxy, strictSSL),
            rejectUnauthorized: strictSSL
        };
        return options;
    }

    downloadContent(urlString: any, proxy: string, strictSSL: boolean): Promise<string> {
        const options = this.buildRequestOptions(urlString, proxy, strictSSL);
        return new Promise<string>((resolve, reject) => {
            https.get(options, function (response) {
                var body = '';
                response.on('data', (chunk) => body + chunk);
                response.on('end', () => resolve(body));
                response.on('error', (err) => reject(new Error(err.message)));
            });
        });
    }

    downloadFile(urlString: string, pathx: string, proxy: string, strictSSL: boolean, status: any): Promise<string> {
        const options = this.buildRequestOptions(urlString, proxy, strictSSL);
        return new Promise<string>((resolve, reject) => {
            let request = https.request(options, response => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    // Redirect - download from new location
                    return resolve(this.downloadFile(response.headers.location, pathx, proxy, strictSSL, status));
                }

                if (response.statusCode !== 200) {
                    return reject(new Error(response.statusCode.toString()));
                }

                // Downloading - hook up events
                let packageSize = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;
                let downloadPercentage = 0;
                let tmpFile = fs.createWriteStream(pathx);

                response.on('data', data => {
                    downloadedBytes += data.length;

                    // Update status bar item with percentage
                    let newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                    if (newPercentage !== downloadPercentage) {
                        downloadPercentage = newPercentage;
                        status.update(null, true, 'Downloading.. (' + newPercentage + "%)");
                    }
                });

                response.on('end', () => resolve());
                response.on('error', err => reject(new Error(err.message)));
                // Begin piping data from the response to the package file
                response.pipe(tmpFile, { end: false });
            });

            request.on('error', error => {
                reject(new Error(error.message));
            });

            // Execute the request
            request.end();
        });
    }
}

export namespace LinterhubInstallation {

    /**
      * Function that installs Linterhub
      * @function install
      * @param {LinterhubMode} mode Describes how to run Cli
      * @param {string} folder Folder to install Linterhub
      * @param {string} proxy
      * @param {boolean} strictSSL
      * @param {LoggerInterface} log Object that will be used for logging
      * @param {StatusInterface} status Object that will be used for changing status
      * @param {string} version What version of Linterhub Cli to install
      * @returns {Promise<string>} Path to Cli
      */
    export function install(mode: LinterhubMode, folder: string, proxy: string, strictSSL: boolean, log: LoggerInterface, status: StatusInterface, version: string): Promise<string> {
        // TODO
        if (mode === LinterhubMode.docker) {
            return downloadDock("repometric/linterhub-cli");
        } else {
            return PlatformInformation.GetCurrent().then(info => {
                log.info("Platform: " + info.toString());
                let helper = new LinterhubPackage(info, folder, mode === LinterhubMode.native, version);
                let name = helper.getPackageFullName();
                log.info("Name: " + name);
                let networkHelper = new NetworkHelper();
                return networkHelper.downloadFile(helper.getPackageUrl(), helper.getPackageFullFileName(), proxy, strictSSL, status).then(() => {
                    log.info("File downloaded");
                    return installFile(helper.getPackageFullFileName(), folder, log).then(() => {
                        return path.resolve(folder, 'bin', helper.getPackageName());
                    });
                });
            });
        }
    }

    function installFile(zipFile: string, folder: any, log: any) {
        return new Promise<string>((resolve, reject) => {

            yauzl.open(zipFile, { autoClose: true, lazyEntries: true }, (err, zipFile) => {
                if (err) {
                    return reject(new Error('Immediate zip file error'));
                }

                zipFile.readEntry();
                zipFile.on('entry', (entry: yauzl.Entry) => {
                    let absoluteEntryPath = path.resolve(/*getBaseInstallPath(pkg)*/
                        folder, entry.fileName);

                    if (entry.fileName.endsWith('/')) {
                        // Directory - create it
                        mkdirp(absoluteEntryPath, { mode: 0o775 }, err => {
                            if (err) {
                                return reject(new Error('Error creating directory for zip directory entry:' + err.code || ''));
                            }

                            zipFile.readEntry();
                        });
                    }
                    else {
                        // File - extract it
                        zipFile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                return reject(new Error('Error reading zip stream'));
                            }

                            mkdirp(path.dirname(absoluteEntryPath), { mode: 0o775 }, err => {
                                if (err) {
                                    return reject(new Error('Error creating directory for zip file entry'));
                                }

                                // Make sure executable files have correct permissions when extracted
                                let fileMode = true //pkg.binaries && pkg.binaries.indexOf(absoluteEntryPath) !== -1
                                    ? 0o755
                                    : 0o664;

                                readStream.pipe(fs.createWriteStream(absoluteEntryPath, { mode: fileMode }));
                                readStream.on('end', () => zipFile.readEntry());
                            });
                        });
                    }
                });

                zipFile.on('end', () => resolve(folder));
                zipFile.on('error', (err: any) => {
                    log.error(err.toString());
                    reject(new Error('Zip File Error:' + err.code || ''));
                });
            });
        });

    }

    /**
      * This function returns Docker version
      * @function getDockerVersion
      * @returns {Promise<string>} Stdout of command
      */
    export function getDockerVersion() {
        return executeChildProcess("docker version --format '{{.Server.Version}}'").then(removeNewLine);
    }

    /**
      * This function returns Dotnet version
      * @function getDotnetVersion
      * @returns {Promise<string>} Stdout of command
      */
    export function getDotnetVersion() {
        return executeChildProcess('dotnet --version').then(removeNewLine);
    }

    function removeNewLine(out: string): string {
        return out.replace('\n', '').replace('\r', '');
    }

    /**
      * Function downloads Docker Image
      * @function downloadDock
      * @param {string} name Name of image to download
      * @returns {Promise<string>} Stdout of command
      */
    export function downloadDock(name: string): Promise<string> {
        return executeChildProcess("docker pull " + name);
    }
}