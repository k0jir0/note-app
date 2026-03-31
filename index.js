const { bootstrapApplication } = require('./src/app/bootstrapApplication');

(async function main() {
    try {
        await bootstrapApplication({
            rootDir: __dirname
        });
    } catch (error) {
        console.error(error && error.message ? error.message : error);
        process.exit(1);
    }
})();
