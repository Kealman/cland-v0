// Native endpoint evidence for a command whose parent/ancestry has already gone.
import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { processIdentitiesAsync } from './process-identity.ts';
import type { SystemProcess } from './process-table.ts';

// Use public spawn stdio duplication, never Node's private stream handles. The
// helper holds the read endpoints on 3/4 for the entire census (no endpoint reuse).
// Darwin layouts: xnu bsd/sys/proc_info.h, socket_fdinfo=792, pipe_fdinfo=184.
// Linux UAPI: include/uapi/linux/{sock_diag,unix_diag,netlink}.h.
const darwin = String.raw`
sub info {
  my ($pid,$fd,$flavor,$size)=@_;
  my $buf="\0" x $size;
  my $n=syscall(336,3,$pid,$flavor,$fd,$buf,$size);
  return $n==$size ? $buf : '';
}
sub endpoint {
  my ($pid,$fd)=@_;
  my $b=info($pid,$fd,3,792);
  if(length($b)==792 && unpack('i',substr($b,176,4))==1 && unpack('i',substr($b,184,4))==1 && unpack('i',substr($b,256,4))==3) {
    return ('s',unpack('Q',substr($b,160,8)),unpack('Q',substr($b,264,8)));
  }
  $b=info($pid,$fd,6,184);
  return ('p',unpack('Q',substr($b,160,8)),unpack('Q',substr($b,168,8))) if length($b)==184;
  return ();
}
my @refs=map { [endpoint($$,$_)] } (3,4);
for my $pid (@ARGV) {
  $pid=0+$pid;
  my $buf="\0" x 1048576;
  my $n=syscall(336,2,$pid,1,0,$buf,length($buf));
  next if $n<=0 || $n%8 || $n>=length($buf);
  for(my $i=0;$i<$n;$i+=8) {
    my ($fd,$type)=unpack('iI',substr($buf,$i,8));
    next unless $type==2 || $type==6;
    my @e=endpoint($pid,$fd);
    next unless @e && $e[1] && $e[2];
    for my $r (@refs) {
      if(@$r && $r->[1] && $r->[2] && $e[0] eq $r->[0] && $e[1]==$r->[2] && $e[2]==$r->[1]) { print "$pid\n"; last; }
    }
  }
}`;
const linux = String.raw`
use Socket;
my %refs;
for my $fd (3,4) { my $s=readlink("/proc/self/fd/$fd"); $refs{$s}=1 if defined($s); }
# AF_NETLINK / SOCK_RAW / NETLINK_SOCK_DIAG, UNIX_DIAG_SHOW_PEER.
socket(my $s,16,3,4) or exit 1;
my $request=pack('I S S I I C C S I I I I I',40,20,0x301,1,0,1,0,0,0xffffffff,0,4,0xffffffff,0xffffffff);
send($s,$request,0,pack('S S I I',16,0,0,0)) or exit 1;
my %peers; my $done=0;
while(!$done) {
  recv($s,my $buf,1048576,0) or exit 1;
  for(my $i=0;$i+16<=length($buf);) {
    my ($n,$type)=unpack('I S',substr($buf,$i,6));
    exit 1 if $n<16 || $i+$n>length($buf);
    if($type==3) { $done=1; last; }
    exit 1 if $type==2;
    if($type==20 && $n>=32) {
      my $ino=unpack('I',substr($buf,$i+20,4));
      for(my $j=$i+32;$j+4<=$i+$n;) {
        my ($len,$attr)=unpack('S S',substr($buf,$j,4));
        exit 1 if $len<4 || $j+$len>$i+$n;
        if($attr==2 && $len==8) { $peers{$ino}=unpack('I',substr($buf,$j+4,4)); }
        $j+=($len+3)&~3;
      }
    }
    $i+=($n+3)&~3;
  }
}
for my $pid (@ARGV) {
  for my $file (glob("/proc/$pid/fd/*")) {
    my $target=readlink($file); next unless defined($target);
    if($target=~/^socket:\[(\d+)\]$/) {
      my $ino=$1; my $peer=$peers{$ino};
      print "$pid\n" if $peer && $refs{"socket:[$peer]"} && ($peers{$peer}//0)==$ino;
    } elsif($target=~/^pipe:\[\d+\]$/ && $refs{$target}) {
      $file=~s@/fd/@/fdinfo/@;
      if(open(my $f,'<',$file)) { local $/; my $info=<$f>; print "$pid\n" if $info=~/^flags:\s+([0-7]+)/m && (oct($1)&3)!=0; }
    }
  }
}`;

/** Returns only rows with coherent native birth before and after the endpoint census.
 * Unknown platform/layout, denied inspection, malformed output and timeouts grant nothing.
 */
export async function stdioWriters(streams: [Readable, Readable], rows: SystemProcess[], env: NodeJS.ProcessEnv): Promise<SystemProcess[]> {
  const script = process.platform === 'darwin' && ['arm64', 'x64'].includes(process.arch) ? darwin : process.platform === 'linux' ? linux : null;
  if (!script) return [];
  // Fixed slots keep the two native probes stable; one EOF never invalidates
  // its live sibling. No descriptors need inspection once both streams close.
  const held = streams.map(stream => stream.readable && !stream.destroyed && !stream.readableEnded ? stream : 'ignore' as const);
  if (held.every(stream => stream === 'ignore')) return [];
  const candidates = rows.filter(row => row.pid !== process.pid && row.pid > 1 && row.identity);
  try {
    const output = await new Promise<string | null>(resolve => {
      const child = spawn('/usr/bin/perl', ['-e', script, '--', ...candidates.map(row => String(row.pid))], {
        env, stdio: ['ignore', 'pipe', 'ignore', ...held], timeout: 3000, killSignal: 'SIGKILL',
      });
      let output = '', invalid = false;
      child.stdout!.setEncoding('utf8').on('data', chunk => {
        if (!invalid) output += chunk;
        if (!invalid && output.length > 1048576) { invalid = true; child.kill('SIGKILL'); }
      });
      child.once('error', () => { invalid = true; });
      child.once('close', code => resolve(code === 0 && !invalid ? output : null));
    });
    if (output === null || !/^(?:[1-9]\d*\n)*$/.test(output)) return [];
    const pids = new Set(output.trim().split('\n').map(Number));
    const after = await processIdentitiesAsync([...pids], env);
    return candidates.filter(row => pids.has(row.pid) && after.get(row.pid) === row.identity);
  } catch { return []; }
  // spawn pauses streams passed as stdio; restore EOF/output observation.
  finally { for (const stream of streams) stream.resume(); }
}
