document.getElementById('recipe-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    try {
        const form = e.target;
    const id = form.dataset.id;

    const formData = new FormData(form);

    const recipeData = {
        name: formData.get('name'),
        description: formData.get('description'),
        ingredients: formData.get('ingredients').split('\n').map(ing => ing.trim()),
        instructions: formData.get('instructions').split('\n').map(inst => inst.trim()),
        prepTime: parseInt(formData.get('prepTime')),
        cookTime: parseInt(formData.get('cookTime')),
        image: formData.get('image'),    
    };

    console.log(recipeData);

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/recipes/${id}` : '/api/recipes';

    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(recipeData)        
        
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Recipe request failed:', response.status, errorText);
        return;
    }

    window.location.href = '/';

    } catch (error) {
        console.error('Error submitting form:', error);
    }

})