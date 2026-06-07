// networking atlas — open with: atlas.html?src=networking
// AI authors ONLY this file on reuse. The template (atlas.html) is frozen.
// d2: graph + `#` annotations (ignored by the d2 compiler, scanned by the atlas).
// tours: the teaching layer — ordered focus/path steps with notes.
window.ATLAS = {
  d2: `# networking model L1-L7 — edge a -> b means "a rides on / depends on b"
app: L7 {
  http
  dns
}
session: L5-6 {
  tls
  socket
}
transport: L4 {
  tcp
  udp
  port
}
network: L3 {
  ip
  route
  nexthop
  arp
  nat
  vrf
}
overlay: VXLAN {
  vxlan
  vtep
  vni
}
link: L2 {
  ethernet
  mac
  vlan
}
phy: L1 {
  nic
  signal
}

app.http -> session.tls
app.http -> transport.port
app.dns -> transport.udp
session.tls -> transport.tcp
session.socket -> transport.tcp
transport.tcp -> network.ip
transport.udp -> network.ip
transport.port -> transport.tcp
network.ip -> network.route
network.route -> network.nexthop
network.nexthop -> network.route
network.nexthop -> link.ethernet
network.ip -> network.arp
network.arp -> link.mac
network.nat -> network.ip
network.vrf -> network.route
overlay.vxlan -> overlay.vtep
overlay.vxlan -> link.ethernet
overlay.vtep -> network.ip
overlay.vni -> overlay.vxlan
link.ethernet -> link.mac
link.vlan -> link.ethernet
link.ethernet -> phy.nic
phy.nic -> phy.signal

# @ network.route : RIB lookup, longest-prefix match over installed prefixes
# @ network.nexthop : recursive resolution until an L2-reachable nexthop
# @ network.route -> network.nexthop : resolve the nexthop for the chosen prefix
# @ overlay.vxlan : L2-over-L3 encap; VNI tags the segment, VTEP is the IP tunnel end
# @ network.nat : rewrites src/dst before the route lookup commits
# diff add network.nat
# diff mod network.route
# src network.route = frr/zebra/zebra_rib.c:120
# src network.nexthop = frr/zebra/zebra_nhg.c:88
# src overlay.vxlan = linux/drivers/net/vxlan/vxlan_core.c:2800
# tag overlay.vxlan : encap, tunnel
# tag overlay.vtep : encap, tunnel
# tag network.nat : stateful, control-plane
# tag network.route : control-plane, routing
# tag network.nexthop : control-plane, routing
# tag network.vrf : control-plane, isolation
# tag transport.tcp : reliable, stateful
# tag transport.udp : datagram`,

  tours: {
    "packet down the stack": [
      { focus: "app.http", isolate: false, note: "HTTP sits at L7. Watch how far down one request reaches." },
      { path: ["app.http", "session.tls", "transport.tcp", "network.ip", "network.route"], isolate: true,
        note: "HTTP → TLS → TCP → IP → route lookup. Each hop is one layer down." },
      { path: ["network.route", "network.nexthop", "link.ethernet", "phy.nic"], isolate: true,
        note: "Route picks a nexthop, resolves to an ethernet frame, leaves via the NIC." },
    ],
    "recursive route resolution": [
      { focus: "network.nexthop", isolate: true,
        note: "Nexthop resolution recurses: route → nexthop → route, until the nexthop is L2-reachable. That loop is the SCC — flip on 'cycles' to see it." },
      { path: ["network.route", "network.nexthop"], isolate: true,
        note: "One step of the recursion. The base case is a connected/ARP-resolved nexthop." },
    ],
    "vxlan overlay encap": [
      { focus: "overlay.vxlan", isolate: true, note: "VXLAN wraps an L2 ethernet frame inside an L3 IP packet." },
      { path: ["overlay.vxlan", "overlay.vtep", "network.ip"], isolate: true,
        note: "The VTEP is the tunnel endpoint — it gives VXLAN its IP transport." },
      { path: ["overlay.vxlan", "link.ethernet"], isolate: true,
        note: "And the inner payload is just an ethernet frame, same as native L2." },
    ],
  },
};
