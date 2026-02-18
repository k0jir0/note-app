async function deleteRecipe(id) {
    const confirmed = confirm('Are you sure you want to delete this recipe?');

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/recipes/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete recipe');
        }

        window.location.href = '/';
    } catch (error) {
        console.error(error);
        alert('Something went wrong!');
    }
}