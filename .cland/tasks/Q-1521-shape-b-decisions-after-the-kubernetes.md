---
id: Q-1521
kind: question
title: Shape B decisions after the Kubernetes research
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: M-1511
blocked_by:
  - Q-1516
  - Q-1517
topic: null
branch: null
created: 2026-10-31T14:35:39.678Z
updated: 2026-10-31T14:35:55.103Z
---

## Question

Shape B decisions (map M-1511 round-1 decision 11), after the Kubernetes research: the distributable (Helm chart or kustomize, image build and publish in the release flow), the hub Deployment with its PVC and SQLite, agent hosts as pods created by the hub through the Kubernetes API or declared in the chart, Ingress and TLS, how the human reaches the hub (web, remotes, port-forward, the CLI), secrets, backups, the droplet executor from a cluster, and what of 0.4.x versus later. Grilling with the human.
