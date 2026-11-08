import { useRef } from "react";
import logo from "../assets/puffin.png";
import ThemeToggle from "./ThemeToggle.jsx";
import { BookmarkIcon, CheckIcon, DiscIcon, PencilIcon, PlusIcon, SearchIcon } from "./Icons.jsx";

export default function Sidebar({
  view,
  go,
  counts,
  crates,
  me,
  onNewCrate,
  onEditCrate,
  onExport,
  onImport,
  onLogout,
}) {
  const fileRef = useRef(null);
  const link = (key, label, icon, count) => (
    <a
      href={`#/${key}`}
      className={`nav-item${view === key ? " is-on" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        go(key);
      }}
    >
      {icon}
      <span className="nav-label">{label}</span>
      {count != null && <span className="nav-count">{count}</span>}
    </a>
  );

  return (
    <nav className="sidebar" aria-label="Shelves and crates">
      <div className="brand">
        <img src={logo} alt="" width={30} height={30} />
        <span>VinylPuffin</span>
      </div>

      <div className="nav-group">
        <p className="nav-heading">Shelves</p>
        {link("want", "Want to listen", <BookmarkIcon />, counts.want)}
        {link("listened", "Listened", <CheckIcon />, counts.listened)}
        {link("library", "Spotify library", <DiscIcon />, counts.library)}
        {link("search", "Find albums", <SearchIcon />)}
      </div>

      <div className="nav-group nav-crates">
        <p className="nav-heading">
          Crates
          <button className="nav-add" onClick={onNewCrate} aria-label="New crate">
            <PlusIcon width={16} height={16} />
          </button>
        </p>
        {crates.length === 0 && (
          <button className="crate-empty" onClick={onNewCrate}>
            Make a crate for anything, like <em>good drum sounds</em>.
          </button>
        )}
        {crates.map((c) => {
          const key = `crate/${c.id}`;
          return (
            <div key={c.id} className={`crate-item${view === key ? " is-on" : ""}`} style={{ "--crate": c.color }}>
              <a
                href={`#/${key}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(key);
                }}
              >
                <span className="crate-tab" />
                <span className="nav-label">{c.name}</span>
                <span className="nav-count">{counts.crates[c.id] || 0}</span>
              </a>
              <button className="crate-edit" onClick={() => onEditCrate(c)} aria-label={`Edit ${c.name}`}>
                <PencilIcon width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="sidebar-foot">
        {me && (
          <div className="me">
            {me.images?.[0]?.url ? <img src={me.images[0].url} alt="" /> : <span className="me-blank" />}
            <span>{me.display_name || me.id}</span>
          </div>
        )}
        <div className="foot-links">
          <button onClick={onExport}>Export</button>
          <button onClick={() => fileRef.current?.click()}>Import</button>
          <button onClick={onLogout}>Log out</button>
        </div>
        <ThemeToggle className="on-dark" />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onImport(file);
          }}
        />
      </div>
    </nav>
  );
}
