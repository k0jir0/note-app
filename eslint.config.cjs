const legacyConfig = require('./.eslintrc.json');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            '**/*.min.js',
            'coverage/**'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: legacyConfig.parserOptions && legacyConfig.parserOptions.ecmaVersion
                ? legacyConfig.parserOptions.ecmaVersion
                : 12,
            sourceType: 'commonjs'
        },
        rules: legacyConfig.rules || {}
    },
    {
        files: ['src/views/public/**/*.js', 'src/views/src/**/*.js'],
        languageOptions: {
            ecmaVersion: legacyConfig.parserOptions && legacyConfig.parserOptions.ecmaVersion
                ? legacyConfig.parserOptions.ecmaVersion
                : 12,
            sourceType: 'script'
        }
    }
];