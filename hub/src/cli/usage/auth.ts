// Pure command help text.
export const AUTH_USAGE = `  auth mode users  switch sign-in mode and print the first user's name, role and 24-hour invite (when web is available)
  auth reset       return to single mode, retaining users and revoking web sessions and open invites
                   local human shell only
`;
export const USER_USAGE = `  user add <name> [--display <name>]  create an invited admin and print a 24-hour link
  user invite <name>                replace open invites with a fresh 24-hour link
  user list        print name, display name, role and state
                   web admins can also create/list users in Accounts in users mode
                   requires cland auth mode users; add/invite require an available web edge
                   local human shell only
`;
