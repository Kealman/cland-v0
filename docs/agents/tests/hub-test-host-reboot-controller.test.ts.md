# hub/test/host-reboot-controller.test.ts

T2 real in-process Unix sockets prove the reboot fixture controller's lifetime;
no native worker or reboot runs. Initial publication fails against a directory,
and held initial publication fails with a connected partial client: setup rejects
only after the listener/clients close. Admission held across close cannot start
reboot after its owner read. An admitted reboot held after client disconnect keeps
ownership metadata until its writer receipt is durable; close joins that work,
then removes its record/socket. All holds have bounded setup and cleanup, and
release in teardown. Control-record publication stages private synced bytes and
removes its owned staging file on failure. These controls supplement the actual
separate CLI/wrong-owner and native recovery test.
