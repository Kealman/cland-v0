#!/usr/bin/env bash
# PROTOTYPE (ticket #11): automated checks for the Neovim-as-host spike.
#   prototypes/nvim-host/checks/run-checks.sh [a b c d e f g h i]   (default: all)
# Drives the prototype through a private tmux server (keys go through the real
# Nvim TUI) and reads state back over msgpack-RPC. Evidence lands in evidence/.
# Never starts the real harnesses: the stand-ins bin/keylog, bin/winch,
# bin/tui-sim and bin/prompt-sim take their place. All checks: about 15 min
# (most of it is check h). Needs tmux, perl, python3 and jq.
source "$(dirname "$0")/lib.sh"

log() { echo "[$(date +%H:%M:%S)] $*"; }
typeln() { keys -l "$1"; keys Enter; }
texts() { for i in "$@"; do echo "--- session $i"; lua "CP.text($i, ${N:-6})" | python3 -c 'import json,sys; [print(l) for l in json.load(sys.stdin)]'; done; }
wait_text() { # session pattern [seconds]
  local i=0
  while [ $i -lt $(( ${3:-10} * 4 )) ]; do
    lua "CP.text($1, 80)" | grep -q -- "$2" && return 0
    pause 0.25
    i=$((i + 1))
  done
  echo "timeout waiting for '$2' in session $1"
  return 1
}
fresh_keylog_session() { # args for keylog; leaves the focus in a terminal running it
  keys 'C-\' j
  pause 0.4
  keys C-c
  typeln "clear; \$CLAND_PROTO_DIR/bin/keylog $*"
  pause 1.0
}

# ---------------------------------------------------------------- a
check_a() {
  log "a: six terminals, typing into each, resize"
  start_proto CLAND_PROTO_FAKE_HARNESS=1
  for _ in 2 3 4 5 6; do keys 'C-\' s; pause 0.7; done
  pause 1
  keys 'C-\' T
  pause 1
  for i in 1 2 3 4 5 6; do
    keys 'C-\' n
    pause 0.5
    typeln "clear; echo out-$i:\$(( $i * 111 )) on \$(tty)"
    pause 0.3
  done
  pause 1
  cap a-1-six-terminals-typed
  lua "CP.state()" > "$EVID/a-1-state.json"
  N=3 texts 1 2 3 4 5 6 > "$EVID/a-1-session-texts.txt"
  for i in 1 2 3 4 5 6; do
    keys 'C-\' n
    pause 0.4
    typeln "clear; \$CLAND_PROTO_DIR/bin/winch term-$i"
    pause 0.3
  done
  pause 1
  cap a-2-winch-started
  T resize-window -t proto -x 160 -y 40
  pause 2
  cap a-3-after-resize-160x40
  lua "CP.state()" > "$EVID/a-3-state.json"
  N=3 texts 1 2 3 4 5 6 > "$EVID/a-3-session-texts.txt"
  T resize-window -t proto -x 200 -y 50
  pause 2
  cap a-4-after-resize-200x50
  lua "CP.state()" > "$EVID/a-4-state.json"
  N=3 texts 1 2 3 4 5 6 > "$EVID/a-4-session-texts.txt"
  # untile: only the focused session stays in a window; resize again
  keys 'C-\' T
  pause 1
  T resize-window -t proto -x 180 -y 44
  pause 2
  lua "CP.state()" > "$EVID/a-5-untiled-state.json"
  N=2 texts 1 2 3 4 5 6 > "$EVID/a-5-untiled-after-resize-texts.txt"
  keys 'C-\' n # shows a session that was hidden during the resize
  pause 1.5
  N=2 texts 1 2 3 4 5 6 > "$EVID/a-6-after-showing-hidden-texts.txt"
  cap a-6-after-showing-hidden
  # keymap wiring with fake harnesses (CLAND_PROTO_FAKE_HARNESS=1): no paid runs
  keys C-c
  keys 'C-\' 'C-n'
  pause 0.3
  keys Space 1
  pause 1.2
  keys 'C-\' 'C-n'
  keys Space 2
  pause 1.2
  keys 'C-\' 'C-n'
  keys Space 3
  pause 1.2
  lua "CP.state()" > "$EVID/a-7-fake-harness-state.json"
  cap a-7-fake-harness-keymaps
  # found on the way: a one-row terminal keeps no scrollback (headless repro)
  NVIM_APPNAME=cland-proto "$NV" --clean --headless -u "$PROTO/checks/one-row-scrollback.lua" > "$EVID/a-8-one-row-scrollback.txt" 2>&1
  log "a: done"
}

# ---------------------------------------------------------------- b
send_keyset() {
  # marker letter, then the key under test; pauses keep every key in its own read()
  keys -l A; pause 0.3; keys Enter; pause 0.4
  keys -l B; pause 0.3; hexkeys 1b 5b 31 33 3b 32 75; pause 0.4              # Shift+Enter, kitty CSI-u
  keys -l C; pause 0.3; hexkeys 1b 5b 32 37 3b 32 3b 31 33 7e; pause 0.4     # Shift+Enter, xterm modifyOtherKeys
  keys -l D; pause 0.3; keys C-c; pause 0.4                                  # Ctrl+C
  keys -l E; pause 0.3; keys Escape; pause 0.4                               # Esc
  keys -l F; pause 0.3; keys Up; pause 0.4
  keys -l G; pause 0.3; keys Down; pause 0.4
  keys -l H; pause 0.3; keys Right; pause 0.4
  keys -l I; pause 0.3; keys Left; pause 0.4
  keys -l J; pause 0.3; keys M-Enter; pause 0.4                              # Alt+Enter (ESC CR)
  keys -l K; pause 0.3; hexkeys 1b 5b 31 33 3b 33 75; pause 0.4              # Alt+Enter, kitty CSI-u
  keys -l L; pause 0.3; keys C-j; pause 0.4                                  # Ctrl+J (LF)
  keys -l M; pause 0.3; keys Tab; pause 0.4
  keys -l N; pause 0.3; keys BTab; pause 0.4                                 # Shift+Tab
  keys -l O; pause 0.3; hexkeys 1b 5b 31 33 3b 35 75; pause 0.4              # Ctrl+Enter, kitty CSI-u
  keys -l P; pause 0.3; hexkeys 1b 5b 31 33 3b 32 3a 33 75; pause 0.4        # Shift+Enter release event (kitty flag 2)
  keys -l Q; pause 0.4
}

check_b() {
  log "b: key fidelity"
  rm -f "$EVID/b-nvim-decoded-keys.log"
  start_proto CLAND_PROTO_KEYLOG="$EVID/b-nvim-decoded-keys.log"
  fresh_keylog_session plain
  send_keyset
  cap b-1-keylog-plain
  keys C-d
  pause 0.5
  fresh_keylog_session -k kitty
  send_keyset
  cap b-2-keylog-kitty-disambiguate
  keys C-d
  pause 0.5
  # the composer (a prompt buffer): Shift+Enter should add a line, Enter sends
  keys 'C-\' c
  pause 0.5
  keys -l 'first line'
  hexkeys 1b 5b 31 33 3b 32 75
  keys -l 'second line'
  keys Enter
  pause 1.2
  lua "CP.thread_tail(9)" > "$EVID/b-3-composer-shift-enter-thread.json"
  # workaround: map <S-CR> in terminal mode to write chosen bytes to the job
  rpc "execute('ClandShiftEnter csi-u')" >/dev/null
  fresh_keylog_session map-csi-u
  keys -l B; pause 0.3; hexkeys 1b 5b 31 33 3b 32 75; pause 0.4
  keys -l C; pause 0.3; hexkeys 1b 5b 32 37 3b 32 3b 31 33 7e; pause 0.4
  keys -l A; pause 0.3; keys Enter; pause 0.4
  cap b-4-shift-enter-mapped-csi-u
  keys C-d
  rpc "execute('ClandShiftEnter esc-cr')" >/dev/null
  fresh_keylog_session map-esc-cr
  keys -l B; pause 0.3; hexkeys 1b 5b 31 33 3b 32 75; pause 0.4
  cap b-5-shift-enter-mapped-esc-cr
  keys C-d
  rpc "execute('ClandShiftEnter off')" >/dev/null
  # through a tmux-owned session (Nvim terminal -> tmux client -> tmux server -> program)
  S kill-session -t b-tmux 2>/dev/null
  keys 'C-\' 'C-n'
  pause 0.3
  keys -l ":ClandTmux b-tmux \$CLAND_PROTO_DIR/bin/keylog -k tmuxed"
  keys Enter
  pause 2
  send_keyset
  cap b-6-keylog-through-tmux
  S capture-pane -p -t b-tmux > "$EVID/b-6-tmux-pane.txt"
  keys C-d
  pause 0.5
  S kill-session -t b-tmux 2>/dev/null
  # the <S-CR> mapping through the tmux layer: tmux extended-keys "on", then "always"
  S -f "$PROTO/tmux-sessions.conf" new-session -d -s sentinel 'sleep 600'
  rpc "execute('ClandShiftEnter csi-u')" >/dev/null
  for mode in on always; do
    S set -g extended-keys "$mode"
    keys 'C-\' 'C-n'
    pause 0.3
    keys -l ":ClandTmux b-tmux-$mode $PROTO/bin/keylog -k mapped-ext-$mode"
    keys Enter
    pause 2
    keys -l B; pause 0.3; hexkeys 1b 5b 31 33 3b 32 75; pause 0.4
    keys -l A; pause 0.3; keys Enter; pause 0.4
    keys -l J; pause 0.3; keys M-Enter; pause 0.4
    S capture-pane -p -t "b-tmux-$mode" > "$EVID/b-7-mapped-shift-enter-through-tmux-extended-keys-$mode.txt"
    keys C-d
    pause 0.5
  done
  rpc "execute('ClandShiftEnter off')" >/dev/null
  S kill-server 2>/dev/null
  log "b: done"
}

# ---------------------------------------------------------------- c
check_c() {
  log "c: paste with TAB characters"
  start_proto
  T set-buffer -b cpaste "$(printf 'alpha\tone\nbeta\ttwo\ngamma\tthree')"
  rpc "execute('set termpastefilter?')" > "$EVID/c-0-termpastefilter-default.txt"
  fresh_keylog_session -p paste-default
  T paste-buffer -p -b cpaste -t proto
  pause 1
  cap c-1-paste-default-filter
  keys C-d
  pause 0.3
  rpc "execute('set termpastefilter=')" >/dev/null
  rpc "execute('set termpastefilter?')" > "$EVID/c-2-termpastefilter-empty.txt"
  fresh_keylog_session -p paste-empty-filter
  T paste-buffer -p -b cpaste -t proto
  pause 1
  cap c-2-paste-empty-filter
  keys C-d
  pause 0.3
  fresh_keylog_session paste-no-bracketed-mode
  T paste-buffer -p -b cpaste -t proto
  pause 1
  cap c-3-paste-program-without-bracketed-paste
  keys C-d
  pause 0.3
  # keep TABs but still strip ESC (so a paste cannot end bracketed paste early)
  rpc "execute('set termpastefilter=BS,ESC,DEL')" >/dev/null
  T set-buffer -b cpaste2 "$(printf 'tab\there\nesc\033[201~injected')"
  fresh_keylog_session -p paste-filter-BS-ESC-DEL
  T paste-buffer -p -b cpaste2 -t proto
  pause 1
  cap c-5-paste-filter-BS-ESC-DEL
  keys C-d
  pause 0.3
  # ordering: a paste followed at once by Enter (as a script driving the TUI would)
  T set-buffer -b cpaste3 "$(printf 'pasted prompt text')"
  fresh_keylog_session -p paste-then-enter
  T paste-buffer -p -b cpaste3 -t proto \; send-keys -t proto Enter
  pause 1
  T paste-buffer -p -b cpaste3 -t proto
  pause 0.3
  keys Enter
  pause 1
  cap c-6-paste-then-enter-ordering
  keys C-d
  pause 0.3
  # the same paste into the composer (a prompt buffer)
  keys 'C-\' c
  pause 0.4
  T paste-buffer -p -b cpaste -t proto
  pause 0.5
  lua "CP.composer()" > "$EVID/c-4-composer-after-paste.json"
  keys Enter
  pause 1.2
  lua "CP.thread_tail(10)" > "$EVID/c-4-thread-after-paste.json"
  log "c: done"
}

# ---------------------------------------------------------------- d
compare() { # name session -> screen vs buffer comparison of the session window
  # buffer read before and after the screen capture, so a row the program
  # rewrites in between (a spinner) is not counted as misrendered
  lua "CP.visible($2)" > "$EVID/$1.visible.json"
  T capture-pane -p -t proto > "$EVID/$1.txt"
  lua "CP.visible($2)" > "$EVID/$1.visible-after.json"
  python3 "$PROTO/checks/compare_screen.py" "$EVID/$1.txt" "$EVID/$1.visible.json" "$EVID/$1.visible-after.json" > "$EVID/$1.compare.txt"
  head -3 "$EVID/$1.compare.txt"
}

check_d() {
  log "d: float over a streaming terminal (neovim#40915)"
  start_proto
  keys 'C-\' j
  pause 0.4
  typeln "clear; for i in \$(seq 1 500); do printf 'stream line %04d %s\\n' \$i \$(printf 'x%.0s' {1..40}); sleep 0.01; done; echo STREAM-\$((1+1))-DONE"
  pause 1.0
  keys 'C-\' a
  pause 1.5
  cap d-1-float-open-while-streaming
  keys q
  wait_text 1 STREAM-2-DONE 20
  pause 0.5
  compare d-2-after-close-stream-done 1
  # inline-TUI stand-in: static frame, only the spinner row is rewritten
  typeln "clear; \$CLAND_PROTO_DIR/bin/tui-sim 10"
  pause 1.5
  keys 'C-\' a
  pause 1.5
  cap d-3-float-open-over-tui-sim
  keys q
  pause 1.5
  compare d-4-after-close-tui-sim-running 1
  wait_text 1 'tui-sim done' 15
  # the same with yes | head -c 200000 as the stream
  typeln "clear; yes 'yes-output-line' | head -c 200000; echo YES-\$((1+1))-DONE"
  keys 'C-\' a
  pause 1
  keys q
  wait_text 1 YES-2-DONE 20
  pause 0.5
  compare d-5-after-close-yes 1
  # the exact steps of neovim#40915: full-editor float, border none, opened and
  # closed in one mapping, over an Ink-like prompt; then type into the prompt
  rpc "execute('luafile $PROTO/checks/repro-40915.lua')" >/dev/null
  for variant in default ui2; do
    if [ "$variant" = ui2 ]; then
      rpc "execute('lua require(\"vim._core.ui2\").enable()')" >/dev/null
    fi
    keys 'C-\' j
    pause 0.4
    typeln "clear; $PROTO/bin/prompt-sim 80"
    pause 1
    keys -l abc
    pause 0.5
    keys 'C-\' 'C-n'
    pause 0.3
    keys Space k
    pause 0.5
    keys i
    pause 0.3
    keys -l hello
    pause 1
    compare "d-6-issue-40915-repro-$variant" 1
    keys C-d
    pause 0.5
  done
  log "d: done"
}

# ---------------------------------------------------------------- e
check_e() {
  log "e: :restart and sessions owned outside Neovim"
  S kill-server 2>/dev/null
  S -f "$PROTO/tmux-sessions.conf" new-session -d -s outside-cat -x 80 -y 20 'cat -v'
  start_proto
  local old_server; old_server=$(addr)
  cp "$RUN/start.json" "$EVID/e-0-start-before.json"
  keys 'C-\' 'C-n'
  keys -l ':ClandRun cat -v'
  keys Enter
  pause 1
  typeln 'typed into nvim-owned cat before restart'
  keys 'C-\' 'C-n'
  keys -l ':ClandAttach outside-cat'
  keys Enter
  pause 1.5
  typeln 'typed into tmux-owned cat before restart'
  pause 0.8
  lua "CP.state()" > "$EVID/e-1-state-before.json"
  cap e-1-before-restart
  S list-panes -a -F '#{session_name} pane_pid=#{pane_pid} #{pane_current_command}' > "$EVID/e-1-tmux-panes-before.txt"
  python3 -c 'import json,sys; [print(s["pid"]) for s in json.load(open(sys.argv[1]))["sessions"]]' "$EVID/e-1-state-before.json" > "$RUN/old-pids"
  keys 'C-\' 'C-n'
  keys -l ':restart'
  keys Enter
  for _ in $(seq 1 60); do
    [ "$(addr)" != "$old_server" ] && break
    pause 0.25
  done
  pause 3
  cp "$RUN/start.json" "$EVID/e-2-start-after.json"
  cap e-2-after-restart
  lua "CP.state()" > "$EVID/e-2-state-after.json"
  lua "CP.restore_log()" > "$EVID/e-2-restore-log.json"
  {
    echo "old session pids (Neovim children before :restart):"
    while read -r p; do
      if ps -p "$p" >/dev/null 2>&1; then echo "  $p ALIVE: $(ps -o command= -p "$p")"; else echo "  $p gone"; fi
    done < "$RUN/old-pids"
    echo "tmux panes after restart:"
    S list-panes -a -F '  #{session_name} pane_pid=#{pane_pid} #{pane_current_command}'
    echo "tmux clients after restart:"
    S list-clients -F '  #{client_name} session=#{session_name} pid=#{client_pid}'
  } > "$EVID/e-3-processes-after-restart.txt"
  S capture-pane -p -t outside-cat > "$EVID/e-3-tmux-outside-cat-after-restart.txt"
  # type into the re-attached session (if it was restored) or attach again
  local tmux_sid
  tmux_sid=$(python3 -c 'import json,sys; s=[x["id"] for x in json.load(open(sys.argv[1]))["sessions"] if "outside-cat" in x["name"]]; print(s[0] if s else "")' "$EVID/e-2-state-after.json")
  if [ -z "$tmux_sid" ]; then
    keys 'C-\' 'C-n'
    keys -l ':ClandAttach outside-cat'
    keys Enter
    pause 1.5
  else
    keys 'C-\' 'C-n'
    keys -l ":ClandFocus $tmux_sid"
    keys Enter
    pause 0.8
  fi
  typeln 'typed into tmux-owned cat after restart'
  pause 0.8
  S capture-pane -p -t outside-cat > "$EVID/e-4-tmux-outside-cat-after-typing.txt"
  cap e-4-after-typing-post-restart
  # :restart! (no session restore)
  old_server=$(addr)
  keys 'C-\' 'C-n'
  keys -l ':restart!'
  keys Enter
  for _ in $(seq 1 60); do
    [ "$(addr)" != "$old_server" ] && break
    pause 0.25
  done
  pause 3
  lua "CP.state()" > "$EVID/e-5-state-after-restart-bang.json"
  cap e-5-after-restart-bang
  S list-sessions > "$EVID/e-5-tmux-sessions-after-restart-bang.txt"
  local bang_pid; bang_pid=$(jq -r .pid "$RUN/start.json")
  T kill-session -t proto 2>/dev/null
  pause 1.5
  S list-sessions > "$EVID/e-6-tmux-sessions-after-nvim-killed.txt" 2>&1
  S kill-server 2>/dev/null
  # Does the Nvim server die with its terminal? (normal start, then after :restart)
  {
    if ps -p "$bang_pid" >/dev/null 2>&1; then
      echo "after :restart!: server $bang_pid ALIVE after its tmux session was killed (ppid $(ps -o ppid= -p "$bang_pid" | tr -d ' '))"
    else
      echo "after :restart!: server $bang_pid exited with its terminal"
    fi
    start_proto
    local spid; spid=$(jq -r .pid "$RUN/start.json")
    T kill-session -t proto
    pause 1.5
    if ps -p "$spid" >/dev/null 2>&1; then echo "normal start: server $spid ALIVE after its tmux session was killed"; else echo "normal start: server $spid exited with its terminal"; fi
  } > "$EVID/e-7-server-vs-terminal.txt"
  cleanup_servers
  # :detach, then re-attach a new TUI with --remote-ui: do the sessions survive?
  start_proto
  keys 'C-\' j
  pause 0.4
  typeln 'echo detach-marker-$((6*7))'
  pause 0.5
  local spid a shell_pid
  spid=$(jq -r .pid "$RUN/start.json")
  a=$(addr)
  shell_pid=$(lua "CP.state()" | jq -r '.sessions[0].pid')
  keys 'C-\' 'C-n'
  keys -l ':detach'
  keys Enter
  pause 1.5
  cap e-8-after-detach
  {
    echo "server $spid alive after :detach: $(ps -p "$spid" >/dev/null 2>&1 && echo yes || echo no)"
    echo "session 1 shell $shell_pid alive after :detach: $(ps -p "$shell_pid" >/dev/null 2>&1 && echo yes || echo no)"
  } > "$EVID/e-8-detach.txt"
  T new-session -d -s reattach -x 200 -y 50 "env NVIM_APPNAME=cland-proto '$NV' --remote-ui --server '$a'"
  pause 2.5
  T capture-pane -p -t reattach > "$EVID/e-8-reattached-with-remote-ui.txt"
  echo "after --remote-ui: session 1 pid $(lua 'CP.state()' | jq -r '.sessions[0].pid') (was $shell_pid), buffer tail: $(lua 'CP.text(1, 2)')" >> "$EVID/e-8-detach.txt"
  T kill-session -t reattach
  pause 1
  cleanup_servers
  log "e: done"
}

# ---------------------------------------------------------------- f
sbinfo() { # session -> scrollback option, buffer line count, first lines
  lua "vim.fn.json_encode({session = $1, name = require('cland_proto.sessions').list[$1].name, scrollback = vim.bo[require('cland_proto.sessions').list[$1].buf].scrollback, line_count = vim.api.nvim_buf_line_count(require('cland_proto.sessions').list[$1].buf), first = vim.api.nvim_buf_get_lines(require('cland_proto.sessions').list[$1].buf, 0, 2, false)})"
}

check_f() {
  log "f: scrollback"
  start_proto
  keys 'C-\' j
  pause 0.4
  typeln "clear; echo BEFORE-LESS; seq -f 'less-line-%g' 1 300 | LESS= less"
  pause 1.5
  cap f-1-less-running
  keys q
  pause 1
  typeln 'echo AFTER-LESS'
  pause 0.8
  rpc "luaeval('vim.fn.json_encode(vim.tbl_filter(function(l) return l:find(\"less%-line%-\") end, vim.api.nvim_buf_get_lines(require(\"cland_proto.sessions\").list[1].buf, 0, -1, false)))')" > "$EVID/f-2-less-lines-in-buffer.json"
  cap f-2-after-less
  typeln "clear; vim --clean -c 'call setline(1, map(range(1, 100), \"\\\"vim-line-\\\" . v:val\"))'"
  pause 1.5
  cap f-3-vim-running
  keys Escape
  keys -l ':qa!'
  keys Enter
  pause 1
  rpc "luaeval('#vim.tbl_filter(function(l) return l:find(\"vim%-line%-\") end, vim.api.nvim_buf_get_lines(require(\"cland_proto.sessions\").list[1].buf, 0, -1, false))')" > "$EVID/f-3-vim-lines-in-buffer.txt"
  # which cap applies depends on when the terminal was made (headless repro)
  NVIM_APPNAME=cland-proto "$NV" --clean --headless -u "$PROTO/checks/scrollback-default.lua" > "$EVID/f-0-scrollback-default-by-creation-time.txt" 2>&1
  # session 1 was created at startup, inside VimEnter
  typeln 'seq 1 20000; echo SEQ20000-$((1+1))-DONE'
  wait_text 1 SEQ20000-2-DONE 30
  pause 0.5
  sbinfo 1 > "$EVID/f-4-session1-made-at-startup-after-seq-20000.json"
  # session 2 is made later and gets the documented default
  keys 'C-\' s
  pause 1
  typeln 'seq 1 20000; echo SEQ20000-$((1+1))-DONE'
  wait_text 2 SEQ20000-2-DONE 30
  pause 0.5
  sbinfo 2 > "$EVID/f-5-session2-made-later-after-seq-20000.json"
  rpc "luaeval('vim.api.nvim_buf_call(require(\"cland_proto.sessions\").list[2].buf, function() vim.opt_local.scrollback = 100000 end)')" >/dev/null
  typeln 'seq 1 60000; echo SEQ60000-$((1+1))-DONE'
  wait_text 2 SEQ60000-2-DONE 60
  pause 0.5
  sbinfo 2 > "$EVID/f-5-session2-scrollback-100000-after-seq-60000.json"
  # a tmux-owned session: where does its history live?
  S kill-session -t f-seq 2>/dev/null
  keys 'C-\' 'C-n'
  keys -l ':ClandTmux f-seq seq -f tmux-line-%g 1 500; sleep 60'
  keys Enter
  pause 2.5
  sbinfo 3 > "$EVID/f-6-tmux-owned-buffer.json"
  S capture-pane -p -S - -t f-seq | grep -c tmux-line- > "$EVID/f-6-tmux-history-line-count.txt"
  cap f-6-tmux-owned-seq
  S kill-session -t f-seq 2>/dev/null
  log "f: done"
}

# ---------------------------------------------------------------- g
check_g() {
  log "g: standalone start"
  start_proto
  {
    echo "start.json (v:argv etc.):"; cat "$RUN/start.json"; echo
    for e in "stdpath('config')" "stdpath('data')" "stdpath('state')" "stdpath('cache')" "\$NVIM_APPNAME" "\$XDG_DATA_DIRS" "\$XDG_CONFIG_DIRS" "&runtimepath" "&packpath" "&shadafile" "&loadplugins"; do
      echo "$e = $(rpc "$e")"
    done
  } > "$EVID/g-1-paths.txt"
  rpc "execute('scriptnames')" > "$EVID/g-2-scriptnames.txt"
  grep -c -E '\.config/nvim|\.local/share/nvim|Ghostty' "$EVID/g-2-scriptnames.txt" > "$EVID/g-2-user-or-ghostty-scripts-count.txt"
  # the same through the TUI, as a human would type it
  keys 'C-\' 'C-n'
  keys -l ":echo stdpath('config') .. '  |  ' .. stdpath('data')"
  keys Enter
  pause 0.6
  cap g-3-echo-stdpath-in-tui
  keys -l ':scriptnames'
  keys Enter
  pause 0.8
  cap g-4-scriptnames-in-tui
  keys q
  keys Escape
  # contrast: the same binary without NVIM_APPNAME (headless, no init file)
  {
    echo "### --clean -u NONE, no NVIM_APPNAME:"
    "$NV" --clean -u NONE --headless +"lua io.stdout:write(vim.o.runtimepath:gsub(',', '\n'))" +qa
    echo
    echo "### NVIM_APPNAME=cland-proto --clean -u NONE:"
    NVIM_APPNAME=cland-proto "$NV" --clean -u NONE --headless +"lua io.stdout:write(vim.o.runtimepath:gsub(',', '\n'))" +qa
    echo
    echo "### what the Ghostty entry provides:"
    find /Applications/Ghostty.app/Contents/Resources/nvim -type f 2>/dev/null | head -20
  } > "$EVID/g-5-runtimepath-contrast.txt" 2>&1
  # quit and show the command run.sh printed
  keys -l ':qa!'
  keys Enter
  pause 1.5
  T capture-pane -p -t proto | grep -v '^$' > "$EVID/g-6-run-sh-printed-command.txt"
  ls -la ~/.config/cland-proto ~/.local/share/cland-proto ~/.local/state/cland-proto ~/.cache/cland-proto > "$EVID/g-7-dirs-created-by-appname.txt" 2>&1
  log "g: done"
}

# ---------------------------------------------------------------- h
probe_typing() { # count label -> per-key latency until the key shows in the composer
  local n=$1 label=$2 k t0 t1 found
  for k in $(seq 1 "$n"); do
    t0=$(now)
    keys -l x
    found=0
    for _ in $(seq 1 500); do
      if T capture-pane -p -t proto | grep -q "you> $(printf 'x%.0s' $(seq 1 "$k"))"; then found=1; break; fi
      pause 0.01
    done
    t1=$(now)
    echo "$label key $k: $(python3 -c "print(round(($t1 - $t0) * 1000))") ms found=$found"
    pause 0.2
  done
}

seq_run() { # session label -> `time seq` in that session while typing into the composer
  local sid=$1 out="$EVID/h-$2.txt" t0 t1
  keys 'C-\' 'C-n'
  keys -l ":ClandFocus $sid"
  keys Enter
  pause 0.5
  echo "session $sid 'scrollback' = $(lua "vim.bo[require('cland_proto.sessions').list[$sid].buf].scrollback")" > "$out"
  lua "CP.lag_reset()" >/dev/null
  typeln "clear; time (seq 1 $H_LINES); echo SEQ-\$((1+1))-DONE"
  t0=$(now)
  keys 'C-\' c
  pause 0.3
  probe_typing 10 "composer during seq" >> "$out"
  keys C-u
  wait_text "$sid" SEQ-2-DONE 900
  t1=$(now)
  echo "wall time from Enter to SEQ-2-DONE (seen over RPC): $(python3 -c "print(round($t1 - $t0, 1))") s" >> "$out"
  N=3 texts "$sid" >> "$out"
  echo "loop lag and scheduled-callback gap during the run (ms): $(lua 'CP.lag()')" >> "$out"
}

check_h() {
  log "h: heavy output"
  H_LINES=${H_LINES:-2000000}
  start_proto
  # baseline 1: generating the lines, no terminal
  ( time (seq 1 "$H_LINES" > /dev/null) ) 2> "$EVID/h-0-baseline-dev-null.txt"
  # baseline 2: a plain tmux pane of the same size, no Neovim
  T new-window -d -t proto: -n base
  T send-keys -t proto:base "clear; time (seq 1 $H_LINES); echo BASE-\$((1+1))-DONE" Enter
  for _ in $(seq 1 900); do T capture-pane -p -t proto:base | grep -q BASE-2-DONE && break; pause 1; done
  T capture-pane -p -t proto:base | grep -E 'total|BASE-2-DONE' > "$EVID/h-0-baseline-plain-tmux-pane.txt"
  T kill-window -t proto:base
  keys 'C-\' c
  pause 0.5
  probe_typing 5 "composer idle" > "$EVID/h-1-typing-latency-idle.txt"
  keys C-u
  # session 2 is made after startup and gets 'scrollback' 10000; session 1 was
  # made in VimEnter and got 1000000 (see check f)
  keys 'C-\' s
  pause 1
  seq_run 2 2-session-scrollback-10000
  seq_run 1 3-session-scrollback-1000000
  cap h-4-screen-after
  log "h: done"
}

# ---------------------------------------------------------------- i
rpc_latency() { # label -> time for a trivial RPC call while a key sequence is pending
  local t0 t1 out
  t0=$(now)
  out=$(RPC_TIMEOUT=20 rpc '1+1')
  t1=$(now)
  echo "$1: rpc '1+1' -> '$out' after $(python3 -c "print(round(($t1 - $t0) * 1000))") ms"
}

check_i() {
  log "i: RPC and scheduled callbacks while the human has input pending"
  start_proto
  local out="$EVID/i-1-pending-input.txt"
  : > "$out"
  keys 'C-\' l # topics window, Normal mode
  pause 0.5
  rpc_latency "baseline, Normal mode, nothing pending" >> "$out"
  lua "CP.lag_reset()" >/dev/null
  keys 2
  ( pause 3; keys Escape ) &
  rpc_latency "count '2' typed in Normal mode, Esc after 3 s" >> "$out"
  wait
  echo "   scheduled-callback max gap: $(lua 'CP.lag()')" >> "$out"
  lua "CP.lag_reset()" >/dev/null
  keys d
  ( pause 3; keys Escape ) &
  rpc_latency "operator 'd' pending in Normal mode, Esc after 3 s" >> "$out"
  wait
  echo "   scheduled-callback max gap: $(lua 'CP.lag()')" >> "$out"
  lua "CP.lag_reset()" >/dev/null
  keys -l ':ec'
  ( pause 3; keys Escape ) &
  rpc_latency "':ec' typed on the cmdline, Esc after 3 s" >> "$out"
  wait
  echo "   scheduled-callback max gap: $(lua 'CP.lag()')" >> "$out"
  keys 'C-\' c
  pause 0.5
  lua "CP.lag_reset()" >/dev/null
  keys -l 'half a message'
  rpc_latency "Insert mode in the composer with text typed" >> "$out"
  keys C-u
  keys 'C-\' j
  pause 0.5
  lua "CP.lag_reset()" >/dev/null
  keys 'C-\'
  ( pause 3; keys -l z ) &
  rpc_latency "Terminal mode, <C-\\> prefix typed, next key after 3 s" >> "$out"
  wait
  echo "   scheduled-callback max gap: $(lua 'CP.lag()')" >> "$out"
  keys BSpace
  keys 'C-\' 'C-n'
  lua "CP.lag_reset()" >/dev/null # before the prompt: an RPC call would wait inside it
  keys -l ':!echo hello'
  keys Enter
  pause 0.5
  cap i-2-hit-enter-prompt
  ( pause 3; keys Enter ) &
  rpc_latency "'Press ENTER' prompt after :!echo, Enter after 3 s" >> "$out"
  wait
  echo "   scheduled-callback max gap: $(lua 'CP.lag()')" >> "$out"
  cat "$out"
  log "i: done"
}

checks="${*:-a b c d e f g h i}"
for c in $checks; do "check_$c"; done
T kill-server 2>/dev/null
S kill-server 2>/dev/null
cleanup_servers
log "all requested checks finished: $checks"
