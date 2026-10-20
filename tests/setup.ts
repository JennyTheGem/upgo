import "@testing-library/jest-dom/vitest"

// jsdom has no layout, so no scrollIntoView.
if (typeof Element !== "undefined") Element.prototype.scrollIntoView ??= () => {}
