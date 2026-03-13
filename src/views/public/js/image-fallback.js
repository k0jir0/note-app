document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img[data-fallback-src]').forEach((image) => {
        image.addEventListener('error', () => {
            const fallbackSrc = image.dataset.fallbackSrc;

            if (!fallbackSrc || image.src.endsWith(fallbackSrc)) {
                return;
            }

            image.src = fallbackSrc;
        }, { once: true });
    });
});
