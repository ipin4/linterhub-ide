/// <reference path="../typings/globals/mocha/index.d.ts"/>

import assert = require("assert");
var sinon = require('sinon');
var util = require('../src/util');
var execute = sinon.stub(util, "executeChildProcess", function (command: string, workingDirectory: string = null): Promise<string> {
    return new Promise((resolve, reject) => {
        resolve(command);
    });
});
import { PlatformInformation } from '../src/platform';
import { LinterhubInstallation, NetworkHelper, LinterhubPackage } from '../src/linterhub-installer';

describe('LinterhubPackage class', function () {
    let version: string = "version";
    let packageName: string = "debian.8-x64";
    let folder: string = "folder";
    let github_prefix: string = "https://github.com/Repometric/linterhub-cli/releases/download/";

    let obj = new LinterhubPackage(new PlatformInformation("linux", "x64"), "folder", true, version);
    it('version check', function () {
        assert.equal(obj.getPackageVersion(), version);
    });
    it('package name check', function () {
        assert.equal(obj.getPackageName(), packageName);
    });
    it('package full name check', function () {
        assert.equal(obj.getPackageFullName(), "linterhub-cli-" + packageName);
    });
    it('package file name check', function () {
        assert.equal(obj.getPackageFileName(), "linterhub-cli-" + packageName + ".zip");
    });
    it('package full file name check', function () {
        assert.equal(obj.getPackageFullFileName(), folder + "/linterhub-cli-" + packageName + ".zip");
    });
    it('package url check', function () {
        assert.equal(obj.getPackageUrl(), github_prefix + version + "/linterhub-cli-" + packageName + ".zip");
    });
});

describe('LinterhubInstallation namespace', function () {
    describe('GetDockerVersion function', function () {
        it('command check', function () {
            return LinterhubInstallation.getDockerVersion().then(function (x) {
                assert.equal(x, "docker version --format \'{{.Server.Version}}\'");
            });
        });
    });

    describe('GetDotnetVersion function', function () {
        it('command check', function () {
            return LinterhubInstallation.getDotnetVersion().then(function (x) {
                assert.equal(x, "dotnet --version");
            });
        });
    });

    describe('DownloadDock function', function () {
        it('command check', function () {
            return LinterhubInstallation.downloadDock("linter").then(function (x) {
                assert.equal(x, "docker pull linter");
            });
        });
    });
});

describe('NetworkHelper class', function () {
    describe('buildRequestOptions function', function () {
        let bro = new NetworkHelper();
        let url = "https://example.com/file.html?param=value";
        let proxy = "https://proxyurl.com";
        it('should return same host', function () {
            assert.equal(bro.buildRequestOptions(url, proxy, true).host, "example.com");
        });
        it('should return same path', function () {
            assert.equal(bro.buildRequestOptions(url, proxy, true).path, "/file.html?param=value");
        });
    });
});

after(function (done) {
    execute.restore();
    done();
});