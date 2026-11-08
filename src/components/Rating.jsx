import { useState } from "react";
import { StarIcon } from "./Icons.jsx";
import { formatRating } from "../collection.js";

// Five stars, half-star precision. Value is 1–10 (or null).
export default function Rating({ value, onChange, size = 30 }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="rating" onMouseLeave={() => setHover(null)}>
      <div className="rating-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = shown >= star * 2 ? 1 : shown >= star * 2 - 1 ? 0.5 : 0;
          return (
            <span className="rating-star" key={star} style={{ width: size, height: size }}>
              <StarIcon fill={fill} width={size} height={size} />
              {[star * 2 - 1, star * 2].map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={value === v}
                  aria-label={`${v / 2} stars`}
                  className={v % 2 ? "half-left" : "half-right"}
                  onMouseEnter={() => setHover(v)}
                  onFocus={() => setHover(v)}
                  onBlur={() => setHover(null)}
                  onClick={() => onChange(value === v ? null : v)}
                />
              ))}
            </span>
          );
        })}
      </div>
      <span className="rating-value">{shown ? formatRating(shown) : "—"}</span>
    </div>
  );
}
