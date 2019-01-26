"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function promiseTimeout(ms, promise) {
    return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
            reject(new Error("Promise timeout"));
        }, ms);
        promise
            .then(function (res) {
            clearTimeout(timer);
            resolve(res);
        })
            .catch(function (err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}
exports.promiseTimeout = promiseTimeout;
function promiseAllTimeout(ms, promiseArray) {
    return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
            reject(new Error("Promise timeout"));
        }, ms);
        Promise.all(promiseArray)
            .then(function (res) {
            clearTimeout(timer);
            resolve(res);
        })
            .catch(function (err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}
exports.promiseAllTimeout = promiseAllTimeout;
//# sourceMappingURL=utils.js.map