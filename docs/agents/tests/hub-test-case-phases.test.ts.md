# hub/test/case-phases.test.ts

Injected-clock controls count completed, failed and pending operations and keep
only one aggregate per fixed phase, including after 100 setup operations. They
run inside the shared whole-case owner without native work. These are recorder
controls, not a reproduction of the Linux slowdown.
