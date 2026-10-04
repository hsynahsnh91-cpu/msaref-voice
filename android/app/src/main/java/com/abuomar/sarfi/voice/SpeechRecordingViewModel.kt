package com.abuomar.sarfi.voice

import android.Manifest
import android.app.Application
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Recording state machine shared by the Compose UI.
 * The UI gates [startListening] behind Accompanist's `rememberPermissionState(Manifest.permission.RECORD_AUDIO)`
 * (declared in android/app/build.gradle.kts), so the mic permission is already resolved here.
 */
enum class MicState { IDLE, REQUESTING_PERMISSION, LISTENING, PROCESSING, DENIED, UNSUPPORTED, ERROR }

data class VoiceUiState(
    val micState: MicState = MicState.IDLE,
    val finalTranscript: String = "",
    val partialTranscript: String = "",
    val rms: Float = 0f,
    val errorMessage: String? = null,
)

class SpeechRecordingViewModel(app: Application) : AndroidViewModel(app) {

    private val _ui = MutableStateFlow(VoiceUiState())
    val ui: StateFlow<VoiceUiState> = _ui.asStateFlow()

    private var recognizer: SpeechRecognizer? = null

    private val syrianLocale: Locale
        get() = Locale.forLanguageTag("ar-SY")

    /** Call after the RECORD_AUDIO permission is granted by Accompanist. */
    fun startListening() {
        val context = getApplication<Application>()
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            _ui.value = _ui.value.copy(micState = MicState.UNSUPPORTED)
            return
        }
        stopListening(commit = false)

        val sr = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = sr
        _ui.value = VoiceUiState(micState = MicState.LISTENING)

        sr.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                _ui.value = _ui.value.copy(micState = MicState.LISTENING, errorMessage = null)
            }

            override fun onBeginningOfSpeech() = Unit

            override fun onRmsChanged(rmsdB: Float) {
                _ui.value = _ui.value.copy(rms = (rmsdB.coerceIn(-2f, 10f) + 2f) / 12f)
            }

            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() {
                _ui.value = _ui.value.copy(micState = MicState.PROCESSING)
            }

            override fun onError(error: Int) {
                val state = when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> MicState.IDLE
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> MicState.DENIED
                    else -> MicState.ERROR
                }
                _ui.value = _ui.value.copy(micState = state, errorMessage = "error_$error")
            }

            override fun onResults(results: Bundle?) {
                val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = list?.firstOrNull().orEmpty()
                _ui.value = _ui.value.copy(
                    micState = MicState.IDLE,
                    finalTranscript = text,
                    partialTranscript = "",
                )
                if (text.isNotBlank()) parseAndSave(text)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val list = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                _ui.value = _ui.value.copy(partialTranscript = list?.firstOrNull().orEmpty())
            }

            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, syrianLocale.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, syrianLocale.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
        sr.startListening(intent)
    }

    fun stopListening(commit: Boolean = true) {
        recognizer?.apply {
            if (commit) stopListening() else cancel()
            destroy()
        }
        recognizer = null
        if (!commit) _ui.value = _ui.value.copy(micState = MicState.IDLE, rms = 0f)
    }

    fun onPermissionResult(granted: Boolean) {
        _ui.value = _ui.value.copy(micState = if (granted) MicState.IDLE else MicState.DENIED)
        if (granted) startListening()
    }

    /** Syrian-dialect parser: amount + currency + category + date, mirroring src/lib/nlu.ts in the web app. */
    private fun parseAndSave(transcript: String) {
        viewModelScope.launch {
            // Repository call goes here (Retrofit/Ktor against /api/recordings?save=true).
        }
    }

    override fun onCleared() {
        recognizer?.destroy()
        recognizer = null
        super.onCleared()
    }

    companion object {
        const val MIC_PERMISSION: String = Manifest.permission.RECORD_AUDIO
    }
}
