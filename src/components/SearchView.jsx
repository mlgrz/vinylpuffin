import { useEffect, useRef, useState } from "react";
import { searchAlbums } from "../spotify/api.js";
import { SearchIcon } from "./Icons.jsx";

// Search all of Spotify, so you can shelve albums you haven't saved.
export default function SearchView({ renderGrid }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("idle");
  const inputRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setHasMore(false);
      setStatus("idle");
      return;
    }
    const id = ++requestRef.current;
    setStatus("loading");
    const timer = setTimeout(() => {
      searchAlbums(q)
        .then((r) => {
          if (id !== requestRef.current) return;
          setResults(r.albums);
          setHasMore(r.hasMore);
          setStatus("ready");
        })
        .catch(() => id === requestRef.current && setStatus("error"));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadMore = () => {
    const id = requestRef.current;
    setStatus("loading");
    searchAlbums(query.trim(), results.length)
      .then((r) => {
        if (id !== requestRef.current) return;
        const seen = new Set(results.map((a) => a.id));
        setResults([...results, ...r.albums.filter((a) => !seen.has(a.id))]);
        setHasMore(r.hasMore);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  return (
    <>
      <div className="toolbar">
        <label className="search-box search-box-lg">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Album or artist…"
            aria-label="Search Spotify for albums"
          />
        </label>
      </div>
      {status === "idle" && (
        <p className="empty">Search Spotify for any album, then shelve it or drop it in a crate.</p>
      )}
      {status === "error" && <p className="empty">Search failed. Try again.</p>}
      {status !== "idle" && status !== "error" && results.length === 0 && status === "ready" && (
        <p className="empty">Nothing found for “{query}”.</p>
      )}
      {results.length > 0 && renderGrid(results)}
      {hasMore && (
        <div className="more">
          <button className="btn btn-ghost" onClick={loadMore} disabled={status === "loading"}>
            {status === "loading" ? "Loading…" : "More results"}
          </button>
        </div>
      )}
    </>
  );
}
