# Server-Side Validation Documentation

## Overview

Comprehensive server-side validation has been implemented across the note-taking application to ensure data integrity, security, and provide clear error messages to users.

## Validation Rules

### Note Validation

#### Title
- **Required**: Yes (for creating new notes)
- **Type**: String
- **Min Length**: 3 characters
- **Max Length**: 200 characters
- **Additional Rules**: Cannot be empty or only whitespace
- **Error Messages**:
  - "Title is required and must be a string"
  - "Title cannot be empty or only whitespace"
  - "Title must be 200 characters or less"
  - "Title must be at least 3 characters long"

#### Content
- **Required**: No (defaults to empty string)
- **Type**: String
- **Max Length**: 10,000 characters
- **Error Messages**:
  - "Content must be a string"
  - "Content must be 10,000 characters or less"

#### Image URL
- **Required**: No (optional field)
- **Type**: String (valid URL)
- **Max Length**: 500 characters
- **Format**: Must be a valid HTTP or HTTPS URL
- **Error Messages**:
  - "Image URL must be a string"
  - "Image must be a valid URL (http:// or https://)"
  - "Image URL must be 500 characters or less"

### User Authentication Validation

#### Email
- **Required**: Yes
- **Type**: String (valid email format)
- **Max Length**: 254 characters
- **Format**: Must match standard email pattern (user@example.com)
- **Additional Rules**: 
  - Automatically converted to lowercase
  - Trimmed of whitespace
  - Must be unique (no duplicate emails)
- **Error Messages**:
  - "Email is required"
  - "Email cannot be empty"
  - "Email is too long"
  - "Please enter a valid email address (e.g., user@example.com)"
  - "This email is already registered. Please login or use a different email."

#### Password
- **Required**: Yes
- **Type**: String
- **Min Length**: 8 characters
- **Max Length**: 128 characters
- **Complexity Requirements**:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
- **Error Messages**:
  - "Password is required"
  - "Password must be at least 8 characters long"
  - "Password must be 128 characters or less"
  - "Password must contain at least one uppercase letter"
  - "Password must contain at least one lowercase letter"
  - "Password must contain at least one number"

## Security Features

### Input Sanitization
All user inputs are sanitized to prevent security vulnerabilities:

1. **XSS Prevention**: HTML tags and script tags are stripped from text inputs
2. **Whitespace Trimming**: Leading and trailing whitespace is removed
3. **User Isolation**: Notes are filtered by authenticated user ID to prevent unauthorized access

### ObjectId Validation
MongoDB ObjectIDs are validated before database queries to prevent:
- Invalid ID format errors
- Injection attacks
- Unnecessary database calls

## Error Response Format

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Brief error description",
  "errors": [
    "Detailed error message 1",
    "Detailed error message 2"
  ]
}
```

### HTTP Status Codes

- **200**: Success
- **201**: Resource created successfully
- **400**: Bad request (validation errors, invalid data)
- **401**: Unauthorized (authentication required)
- **404**: Resource not found or access denied
- **409**: Conflict (duplicate entry)
- **500**: Server error

## Frontend Error Display

### Note Forms
Validation errors are displayed:
- At the top of the form in a red alert box
- As a bulleted list of specific issues
- With automatic scroll to error message
- Errors clear automatically on form resubmission

### Delete Operations
Errors are displayed via:
- Browser alert dialogs
- Clear, user-friendly messages from the server

### Login/Signup Forms
Authentication errors are displayed:
- Above the form fields
- In a clear error message format
- With specific guidance on how to fix the issue

## Validation Testing

To test validation, try these scenarios:

### Note Creation/Update
1. ✗ Empty title → "Title is required"
2. ✗ Title with 2 characters → "Title must be at least 3 characters long"
3. ✗ Title with 201 characters → "Title must be 200 characters or less"
4. ✗ Content with 10,001 characters → "Content must be 10,000 characters or less"
5. ✗ Invalid image URL ("not-a-url") → "Image must be a valid URL"
6. ✓ Valid data → Success

### User Signup
1. ✗ Invalid email format → "Please enter a valid email address"
2. ✗ Password less than 8 chars → "Password must be at least 8 characters long"
3. ✗ Password without uppercase → "Password must contain at least one uppercase letter"
4. ✗ Password without lowercase → "Password must contain at least one lowercase letter"
5. ✗ Password without number → "Password must contain at least one number"
6. ✗ Duplicate email → "This email is already registered"
7. ✓ Valid credentials → Account created

### Note Access Control
1. ✗ Invalid note ID → "Invalid note ID format"
2. ✗ Note belonging to another user → "Note not found or access denied"
3. ✓ Own note → Success

## Files Modified

### Backend
- `src/utils/validation.js` - Centralized validation functions
- `src/controllers/noteApiController.js` - Enhanced with validation
- `src/routes/authRoutes.js` - Added email/password validation

### Frontend
- `src/views/public/js/note-form.js` - Error display functionality
- `src/views/public/js/notes.js` - Error handling for delete operations

## Best Practices Implemented

1. **Defense in Depth**: Validation on both frontend (HTML5) and backend
2. **Clear Error Messages**: User-friendly, actionable error descriptions
3. **Consistent Responses**: All endpoints follow the same error format
4. **Input Sanitization**: Protection against XSS and injection attacks
5. **Type Checking**: Explicit type validation before processing
6. **Length Limits**: Prevent database overflow and performance issues
7. **Format Validation**: URL and email format verification
8. **User Feedback**: Real-time error display with visual cues
