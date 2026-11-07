package expo.modules.smsreader

/** A message can only go to one destination, identified by account text in its body. */
object RelayRouting {
  fun matchingTargets(markers: List<List<String>>, body: String): List<Int> =
    markers.indices.filter { index -> markers[index].any { it.isNotBlank() && body.contains(it, ignoreCase = true) } }
}
