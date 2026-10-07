# PROTOTYPE (ticket #11): helpers for the automated checks. Source it from
# checks/run-checks.sh. Everything runs on a private tmux server (socket
# "cland11-test", no user tmux.conf) so the user's own tmux is untouched.
set -u

PROTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$PROTO/../.." && pwd)"
NV="$PROTO/.nvim/nvim-macos-arm64/bin/nvim"
EVID="$PROTO/evidence"
RUN="$PROTO/.run"
TSOCK=cland11-test
SSOCK=cland-proto # the socket of the tmux server that owns sessions outside Neovim
mkdir -p "$EVID" "$RUN"

T() { tmux -L "$TSOCK" -f /dev/null "$@"; }
S() { tmux -L "$SSOCK" "$@"; }

now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }
pause() { perl -e "select(undef,undef,undef,$1)"; }

# Start the prototype in a fresh 200x50 tmux session "proto" (extra env vars
# as arguments, e.g. CLAND_PROTO_FAKE_HARNESS=1).
start_proto() {
  T kill-session -t proto 2>/dev/null
  rm -f "$RUN/servername"
  T new-session -d -s proto -x "${COLS:-200}" -y "${ROWS:-50}" -c "$REPO"
  T set-option -t proto remain-on-exit on >/dev/null
  T send-keys -t proto "cd '$REPO' && env $* prototypes/nvim-host/run.sh" Enter
  for _ in $(seq 1 100); do
    [ -s "$RUN/servername" ] && break
    pause 0.1
  done
  pause 1.0
}

addr() { cat "$RUN/servername"; }

# Evaluate a Vimscript expression in the running prototype over msgpack-RPC.
# (perl alarm = a timeout, since a pending Normal-mode command stalls RPC)
rpc() {
  NVIM_APPNAME=cland-proto perl -e 'alarm shift; exec @ARGV' "${RPC_TIMEOUT:-15}" \
    "$NV" --clean --headless --server "$(addr)" --remote-expr "$1" 2>&1
}
lua() { rpc "luaeval(\"$1\")"; }
cmd() { rpc "execute('$1')" >/dev/null; }

# Kill prototype Nvim servers that outlived their UI: a server started by
# :restart is re-parented to launchd and survives its terminal (check e).
cleanup_servers() { pkill -f -- "--embed --clean -u $PROTO/init.lua" 2>/dev/null; true; }

cap() { T capture-pane -p -t proto > "$EVID/$1.txt"; }
keys() { T send-keys -t proto "$@"; }
hexkeys() { T send-keys -t proto -H "$@"; }
