package expo.modules.boomloudness

import android.media.audiofx.LoudnessEnhancer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BoomLoudnessModule : Module() {
  private var enhancer: LoudnessEnhancer? = null

  override fun definition() = ModuleDefinition {
    Name("BoomLoudness")

    AsyncFunction("setTargetGainMilliBel") { gainMilliBel: Int ->
      val gain = gainMilliBel.coerceAtLeast(0)
      if (gain == 0) {
        enhancer?.enabled = false
        return@AsyncFunction
      }

      if (enhancer == null) {
        enhancer = LoudnessEnhancer(0).apply { enabled = true }
      } else {
        enhancer?.enabled = true
      }

      enhancer?.setTargetGain(gain)
    }

    AsyncFunction("release") {
      enhancer?.release()
      enhancer = null
    }
  }
}
