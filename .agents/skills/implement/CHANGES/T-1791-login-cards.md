# T-1791 sign-in cards

Document the default captured Host `signin-v1` card operation, shared native
types/close parser and CLI preparation/snapshot owners. Expiry changes card
visibility and input admission only; native close still gates disk settlement.
CLI permission is unchanged; card answers use the existing human surfaces.

Review correction: buffer early output until the run handle is captured and
prearm input before card publication. Conditional owner-loss guidance separates
renewal interruption from the retained creating/mounted new-login cut.
