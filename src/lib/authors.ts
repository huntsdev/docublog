export const DEFAULT_AUTHOR = 'Ryan Hunt';

type AuthorProfile = { name: string; avatar?: string; image?: string; url?: string };

export function getAuthorProfile(name: string): AuthorProfile {
  return name === DEFAULT_AUTHOR
    ? { name, avatar: '/images/ryan-hunt-192.png', image: '/images/ryan-hunt.png', url: '/about/' }
    : { name };
}
