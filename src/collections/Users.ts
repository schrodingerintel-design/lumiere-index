import type { CollectionConfig } from 'payload'

/**
 * Staff accounts. Authentication is Payload's own email/password flow.
 * Roles and the editorial capability matrix arrive in Phase 4, together with
 * the access functions that enforce them on the server.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'updatedAt'],
  },
  auth: true,
  access: {
    // Until the Phase 4 capability matrix exists, staff records are closed to
    // the public entirely. The first admin user is still created through the
    // admin panel, which bypasses access control for that flow.
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
    admin: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
