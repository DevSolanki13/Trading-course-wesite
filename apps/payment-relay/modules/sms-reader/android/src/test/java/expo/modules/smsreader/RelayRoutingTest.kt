package expo.modules.smsreader

import org.junit.Assert.assertEquals
import org.junit.Test

class RelayRoutingTest {
  @Test fun routesAccountsExclusively() {
    val markers = listOf(listOf("XX1234"), listOf("XX5678"))
    assertEquals(listOf(0), RelayRouting.matchingTargets(markers, "A/c xx1234 credited INR 100.01"))
    assertEquals(listOf(1), RelayRouting.matchingTargets(markers, "A/c XX5678 credited INR 100.01"))
    assertEquals(emptyList<Int>(), RelayRouting.matchingTargets(markers, "Received INR 100.01"))
    // Ambiguity is visible to the caller and must never fan out a payment.
    assertEquals(listOf(0, 1), RelayRouting.matchingTargets(markers, "XX1234 to XX5678 INR 100.01"))
    assertEquals(emptyList<Int>(), RelayRouting.matchingTargets(listOf(listOf("")), "anything"))
  }
}
