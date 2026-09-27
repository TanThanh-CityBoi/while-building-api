/**
 * Permissions for content (articles, projects, publishing…). Owned by the
 * content context; granted to roles by the auth context's role policy.
 */
export enum ContentPermission {
  CONTENT_READ = 'CONTENT_READ',
  CONTENT_CREATE = 'CONTENT_CREATE',
  CONTENT_UPDATE = 'CONTENT_UPDATE',
  CONTENT_DELETE = 'CONTENT_DELETE',
  CONTENT_PUBLISH = 'CONTENT_PUBLISH',
}
