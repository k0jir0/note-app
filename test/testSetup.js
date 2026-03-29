process.env.NODE_ENV = 'test';
process.env.DISABLE_REDIS = '1';

if (!process.env.NOTE_ENCRYPTION_KEY) {
	process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}
