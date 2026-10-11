import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { SITE } from "../content/site";

export const meta: MetaFunction = () => {
  return [
    { title: `Page not found · ${SITE.name}` },
    {
      name: "description",
      content: "There is nothing at this address.",
    },
    { name: "robots", content: "noindex" },
  ];
};

export default function NotFound() {
  return (
    <main id="main" className="notfound">
      <p className="kicker">404</p>
      <h1>Nothing here.</h1>
      <p className="lede">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className="button">
        Back to the gate
      </Link>
    </main>
  );
}
