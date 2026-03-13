async function deleteNote(id) {
    const csrfToken = window.getCsrfToken();
    const confirmed = confirm('Are you sure you want to delete this note?');

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/notes/${id}`, {
            method: 'DELETE',
            headers: {
                'x-csrf-token': csrfToken
            }
        });

        const result = await response.json();

        if (!response.ok) {
            // Display error message from server
            let errorMessage = 'Failed to delete note';
            if (result.errors && Array.isArray(result.errors)) {
                errorMessage = result.errors.join('. ');
            } else if (result.message) {
                errorMessage = result.message;
            }
            alert(errorMessage);
            console.error('Delete failed:', result);
            return;
        }

        // Success - redirect to home
        window.location.href = '/';
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Network error. Please check your connection and try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.note-delete-button').forEach((button) => {
        button.addEventListener('click', () => {
            deleteNote(button.dataset.noteId);
        });
    });
});
