document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const form = e.target;
        const id = form.dataset.id;
        const csrfToken = window.getCsrfToken();

        // Clear any existing error messages
        clearErrors();

        const formData = new FormData(form);

        const noteData = {
            title: formData.get('title'),
            content: formData.get('content'),
            image: formData.get('image')
        };

        console.log('Submitting note:', noteData);

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/notes/${id}` : '/api/notes';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify(noteData)
        });

        const result = await response.json();

        if (!response.ok) {
            // Display validation errors
            if (result.errors && Array.isArray(result.errors)) {
                displayErrors(result.errors);
            } else if (result.message) {
                displayErrors([result.message]);
            } else {
                displayErrors(['An error occurred. Please try again.']);
            }
            console.error('Note request failed:', response.status, result);
            return;
        }

        // Success - redirect to home
        window.location.href = '/';

    } catch (error) {
        console.error('Error submitting form:', error);
        displayErrors(['Network error. Please check your connection and try again.']);
    }
});

/**
 * Display error messages on the form
 * @param {string[]} errors - Array of error messages
 */
function displayErrors(errors) {
    // Remove any existing error display
    clearErrors();

    // Create error container
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger mt-3';
    errorDiv.id = 'form-errors';
    errorDiv.setAttribute('role', 'alert');

    // Add error title
    const errorTitle = document.createElement('strong');
    errorTitle.textContent = 'Please fix the following errors:';
    errorDiv.appendChild(errorTitle);

    // Add error list
    const errorList = document.createElement('ul');
    errorList.className = 'mb-0 mt-2';
    errors.forEach(error => {
        const li = document.createElement('li');
        li.textContent = error;
        errorList.appendChild(li);
    });
    errorDiv.appendChild(errorList);

    // Insert error div at the top of the form
    const form = document.getElementById('note-form');
    form.insertBefore(errorDiv, form.firstChild);

    // Scroll to error message
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Clear all error messages from the form
 */
function clearErrors() {
    const existingErrors = document.getElementById('form-errors');
    if (existingErrors) {
        existingErrors.remove();
    }
}
