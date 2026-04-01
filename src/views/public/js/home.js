async function fetchNotesSummary() {
    try {
        const response = await fetch('/api/notes?limit=5', {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('Notes summary fetch returned status', response.status);
            return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            console.warn('Notes summary response was not JSON');
            return;
        }

        const data = await response.json();
        console.debug('Fetched notes summary:', data.count);
    } catch (error) {
        console.error('Error fetching notes summary:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchNotesSummary();
});
