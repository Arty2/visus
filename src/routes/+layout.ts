// Static by default. Add a server load function (and drop this to false) the
// day a route needs a request at render time; until then every page ships as
// a prerendered file and there is nothing for a server to do at runtime.
export const prerender = true;
