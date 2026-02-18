const { expect } = require('chai');
const {
    validateNoteData,
    validateEmail,
    validatePassword,
    sanitizeString,
    sanitizeNoteData,
    isValidUrl
} = require('../src/utils/validation');

describe('Validation Utilities', () => {
    describe('validateNoteData', () => {
        it('should validate a valid note', () => {
            const data = {
                title: 'Valid Title',
                content: 'This is valid content',
                image: 'https://example.com/image.jpg'
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.true;
            expect(result.errors).to.be.empty;
        });

        it('should reject missing title', () => {
            const data = {
                content: 'Content without title'
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Title is required and must be a string');
        });

        it('should reject empty title', () => {
            const data = {
                title: '   ',
                content: 'Content'
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Title cannot be empty or only whitespace');
        });

        it('should reject title shorter than 3 characters', () => {
            const data = {
                title: 'ab',
                content: 'Content'
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Title must be at least 3 characters long');
        });

        it('should reject title longer than 200 characters', () => {
            const data = {
                title: 'a'.repeat(201),
                content: 'Content'
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Title must be 200 characters or less');
        });

        it('should reject content longer than 10,000 characters', () => {
            const data = {
                title: 'Valid Title',
                content: 'a'.repeat(10001)
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Content must be 10,000 characters or less');
        });

        it('should accept empty content', () => {
            const data = {
                title: 'Valid Title',
                content: ''
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.true;
        });

        it('should reject invalid image URL', () => {
            const data = {
                title: 'Valid Title',
                content: 'Content',
                image: 'not-a-valid-url'
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Image must be a valid URL (http:// or https://)');
        });

        it('should accept valid http and https URLs', () => {
            const data1 = {
                title: 'Valid Title',
                content: 'Content',
                image: 'http://example.com/image.jpg'
            };

            const data2 = {
                title: 'Valid Title',
                content: 'Content',
                image: 'https://example.com/image.jpg'
            };

            expect(validateNoteData(data1).isValid).to.be.true;
            expect(validateNoteData(data2).isValid).to.be.true;
        });

        it('should accept empty image string', () => {
            const data = {
                title: 'Valid Title',
                content: 'Content',
                image: ''
            };

            const result = validateNoteData(data);

            expect(result.isValid).to.be.true;
        });

        it('should allow updates without title when isUpdate is true', () => {
            const data = {
                content: 'Updated content only'
            };

            const result = validateNoteData(data, true);

            expect(result.isValid).to.be.true;
        });

        it('should still validate title when provided in update', () => {
            const data = {
                title: 'ab' // Too short
            };

            const result = validateNoteData(data, true);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Title must be at least 3 characters long');
        });
    });

    describe('validateEmail', () => {
        it('should validate a correct email', () => {
            const result = validateEmail('test@example.com');

            expect(result.isValid).to.be.true;
            expect(result.error).to.be.null;
        });

        it('should reject missing email', () => {
            const result = validateEmail('');

            expect(result.isValid).to.be.false;
            expect(result.error).to.exist;
        });

        it('should reject null or undefined email', () => {
            expect(validateEmail(null).isValid).to.be.false;
            expect(validateEmail(undefined).isValid).to.be.false;
        });

        it('should reject email without @', () => {
            const result = validateEmail('invalidemail.com');

            expect(result.isValid).to.be.false;
            expect(result.error).to.include('valid email address');
        });

        it('should reject email without domain', () => {
            const result = validateEmail('user@');

            expect(result.isValid).to.be.false;
            expect(result.error).to.include('valid email address');
        });

        it('should reject email without local part', () => {
            const result = validateEmail('@example.com');

            expect(result.isValid).to.be.false;
            expect(result.error).to.include('valid email address');
        });

        it('should trim and validate email', () => {
            const result = validateEmail('  test@example.com  ');

            expect(result.isValid).to.be.true;
        });

        it('should reject email longer than 254 characters', () => {
            const longEmail = 'a'.repeat(250) + '@example.com';
            const result = validateEmail(longEmail);

            expect(result.isValid).to.be.false;
            expect(result.error).to.equal('Email is too long');
        });

        it('should accept email with subdomain', () => {
            const result = validateEmail('user@mail.example.com');

            expect(result.isValid).to.be.true;
        });

        it('should accept email with numbers and dots', () => {
            const result = validateEmail('user.name123@example.co.uk');

            expect(result.isValid).to.be.true;
        });
    });

    describe('validatePassword', () => {
        it('should validate a strong password', () => {
            const result = validatePassword('StrongPass123');

            expect(result.isValid).to.be.true;
            expect(result.errors).to.be.empty;
        });

        it('should reject missing password', () => {
            const result = validatePassword('');

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Password is required');
        });

        it('should reject null or undefined password', () => {
            expect(validatePassword(null).isValid).to.be.false;
            expect(validatePassword(undefined).isValid).to.be.false;
        });

        it('should reject password shorter than 8 characters', () => {
            const result = validatePassword('Pass1');

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Password must be at least 8 characters long');
        });

        it('should reject password without uppercase letter', () => {
            const result = validatePassword('password123');

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Password must contain at least one uppercase letter');
        });

        it('should reject password without lowercase letter', () => {
            const result = validatePassword('PASSWORD123');

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Password must contain at least one lowercase letter');
        });

        it('should reject password without number', () => {
            const result = validatePassword('PasswordOnly');

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Password must contain at least one number');
        });

        it('should reject password longer than 128 characters', () => {
            const longPassword = 'A1' + 'a'.repeat(127);
            const result = validatePassword(longPassword);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Password must be 128 characters or less');
        });

        it('should return multiple errors for weak password', () => {
            const result = validatePassword('weak');

            expect(result.isValid).to.be.false;
            expect(result.errors.length).to.be.greaterThan(1);
        });

        it('should accept password with special characters', () => {
            const result = validatePassword('Strong@Pass123!');

            expect(result.isValid).to.be.true;
        });
    });

    describe('isValidUrl', () => {
        it('should validate http URL', () => {
            expect(isValidUrl('http://example.com')).to.be.true;
        });

        it('should validate https URL', () => {
            expect(isValidUrl('https://example.com')).to.be.true;
        });

        it('should reject ftp URL', () => {
            expect(isValidUrl('ftp://example.com')).to.be.false;
        });

        it('should reject malformed URL', () => {
            expect(isValidUrl('not a url')).to.be.false;
        });

        it('should reject empty string', () => {
            expect(isValidUrl('')).to.be.false;
        });

        it('should reject null', () => {
            expect(isValidUrl(null)).to.be.false;
        });

        it('should accept URL with path', () => {
            expect(isValidUrl('https://example.com/path/to/resource')).to.be.true;
        });

        it('should accept URL with query parameters', () => {
            expect(isValidUrl('https://example.com?key=value')).to.be.true;
        });
    });

    describe('sanitizeString', () => {
        it('should remove script tags', () => {
            const input = 'Hello <script>alert("xss")</script> World';
            const result = sanitizeString(input);

            expect(result).to.equal('Hello  World');
        });

        it('should remove all HTML tags', () => {
            const input = '<div>Hello <b>World</b></div>';
            const result = sanitizeString(input);

            expect(result).to.equal('Hello World');
        });

        it('should trim whitespace', () => {
            const input = '  Hello World  ';
            const result = sanitizeString(input);

            expect(result).to.equal('Hello World');
        });

        it('should handle non-string input', () => {
            expect(sanitizeString(123)).to.equal(123);
            expect(sanitizeString(null)).to.equal(null);
            expect(sanitizeString(undefined)).to.equal(undefined);
        });

        it('should handle empty string', () => {
            const result = sanitizeString('');

            expect(result).to.equal('');
        });

        it('should remove multiple script tags', () => {
            const input = '<script>bad</script>Good<script>bad</script>';
            const result = sanitizeString(input);

            expect(result).to.equal('Good');
        });
    });

    describe('sanitizeNoteData', () => {
        it('should sanitize title', () => {
            const data = {
                title: '<script>alert("xss")</script>Title'
            };

            const result = sanitizeNoteData(data);

            expect(result.title).to.equal('Title');
        });

        it('should trim content', () => {
            const data = {
                content: '  Content with spaces  '
            };

            const result = sanitizeNoteData(data);

            expect(result.content).to.equal('Content with spaces');
        });

        it('should trim image URL', () => {
            const data = {
                image: '  https://example.com/image.jpg  '
            };

            const result = sanitizeNoteData(data);

            expect(result.image).to.equal('https://example.com/image.jpg');
        });

        it('should handle all fields together', () => {
            const data = {
                title: '  <b>Bold Title</b>  ',
                content: '  Content  ',
                image: '  https://example.com/image.jpg  '
            };

            const result = sanitizeNoteData(data);

            expect(result.title).to.equal('Bold Title');
            expect(result.content).to.equal('Content');
            expect(result.image).to.equal('https://example.com/image.jpg');
        });

        it('should only process provided fields', () => {
            const data = {
                title: 'Title'
            };

            const result = sanitizeNoteData(data);

            expect(result.title).to.equal('Title');
            expect(result.content).to.be.undefined;
            expect(result.image).to.be.undefined;
        });

        it('should handle non-string values', () => {
            const data = {
                title: 123,
                content: null,
                image: undefined
            };

            const result = sanitizeNoteData(data);

            expect(result.title).to.equal(123);
            expect(result.content).to.equal(null);
            expect(result.image).to.equal(undefined);
        });
    });
});
