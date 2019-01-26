/**
 * Wait promise to finish before timeout
 * @param {number} ms
 * @param {Promise<any>} promise
 * @returns {Promise<any>}
 */
export function promiseTimeout(ms: number, promise: Promise<any>){
    return new Promise(function(resolve, reject){
        // create a timeout to reject promise if not resolved
        var timer = setTimeout(function(){
            reject(new Error("Promise timeout"));
        }, ms);

        promise
            .then(function(res){
                clearTimeout(timer);
                resolve(res);
            })
            .catch(function(err){
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Wait all promises to finish before timeout
 * @param {number} ms
 * @param {Promise<any>[]} promiseArray
 * @returns {Promise<any>}
 */
export function promiseAllTimeout(ms: number, promiseArray: Promise<any>[]){
    return new Promise(function(resolve, reject){
        // create a timeout to reject promise if not resolved
        var timer = setTimeout(function(){
            reject(new Error("Promise timeout"));
        }, ms);

        Promise.all(promiseArray)
            .then(function(res){
                clearTimeout(timer);
                resolve(res);
            })
            .catch(function(err){
                clearTimeout(timer);
                reject(err);
            });
    });
}