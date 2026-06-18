import { useEffect } from 'react';

const DEFAULT_DESCRIPTION =
  'The coaching platform built for competition prep. Manage peak week, programs, nutrition, check-ins and client messaging in one place.';

function upsertMeta(name, content, attr = 'name') {
  if (!content) return;
  let tag = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export default function PageMeta({ title, description = DEFAULT_DESCRIPTION }) {
  useEffect(() => {
    if (title) document.title = title;
    upsertMeta('description', description);
    upsertMeta('og:title', title, 'property');
    upsertMeta('og:description', description, 'property');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);
  }, [title, description]);

  return null;
}
