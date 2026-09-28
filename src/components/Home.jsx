import { useCallback, useEffect, useRef, useState } from "react";
import '../assets/style/Home.css';

const CODE_LENGTH = 4;
const RESEND_SECONDS = 30;
const IDLE_DEMO_DELAY_MS = 6000; // auto-fill the demo code if nobody types
const COMPLETE_DELAY_MS = 250; // let the 4th digit register before detaching
const VERIFY_MS = 2800; // orbit duration
const COLLAPSE_MS = 900; // implosion duration
const DEMO_CODE = ["4", "1", "8", "2"];

const emptyCode = () => Array(CODE_LENGTH).fill("");

/*
  phase: "idle" -> "verifying" -> "collapsing" -> "success"
*/
export default function Home({ onContinue = () => {} }) {
  const [digits, setDigits] = useState(emptyCode);
  const [phase, setPhase] = useState("idle");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRefs = useRef([]);

  const focusInput = useCallback((index) => {
    const el = inputRefs.current[index];
    if (el) el.focus();
  }, []);

  const setDigitAt = (index, value) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const fillFrom = (start, text) => {
    const chars = text.slice(0, CODE_LENGTH - start).split("");
    if (!chars.length) return;
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => {
        next[start + k] = c;
      });
      return next;
    });
    focusInput(Math.min(start + chars.length, CODE_LENGTH - 1));
  };

  /* Auto-focus the first input whenever we are (back) in the idle phase */
  useEffect(() => {
    if (phase === "idle") focusInput(0);
  }, [phase, focusInput]);

  /* Fire the animation pipeline as soon as the 4th digit is in */
  useEffect(() => {
    if (phase !== "idle" || !digits.every(Boolean)) return undefined;
    const id = setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setPhase("verifying");
    }, COMPLETE_DELAY_MS);
    return () => clearTimeout(id);
  }, [digits, phase]);

  /* verifying -> collapsing -> success */
  useEffect(() => {
    if (phase === "verifying") {
      const id = setTimeout(() => setPhase("collapsing"), VERIFY_MS);
      return () => clearTimeout(id);
    }
    if (phase === "collapsing") {
      const id = setTimeout(() => setPhase("success"), COLLAPSE_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase]);

  /* Resend countdown (only ticks while idle) */
  useEffect(() => {
    if (phase !== "idle" || secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, secondsLeft]);

  /* Demo flow: if left idle, type the code for the user */
  useEffect(() => {
    if (phase !== "idle") return undefined;
    const id = setTimeout(() => setDigits(DEMO_CODE), IDLE_DEMO_DELAY_MS);
    return () => clearTimeout(id);
  }, [phase, digits]);

  const handleKeyDown = (index, e) => {
    if (phase !== "idle") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      setDigitAt(index, e.key);
      if (index < CODE_LENGTH - 1) focusInput(index + 1);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigitAt(index, "");
      } else if (index > 0) {
        setDigitAt(index - 1, "");
        focusInput(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    }
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  /* Fallback for mobile keyboards / SMS autofill where keydown is unreliable */
  const handleChange = (index, e) => {
    if (phase !== "idle") return;
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setDigitAt(index, "");
      return;
    }
    fillFrom(index, digits[index] && raw.length > 1 ? raw.slice(-1) : raw);
  };

  const handlePaste = (index, e) => {
    if (phase !== "idle") return;
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    fillFrom(index, text);
  };

  const resetDemo = () => {
    setDigits(emptyCode());
    setSecondsLeft(RESEND_SECONDS);
    setPhase("idle");
    focusInput(0);
  };

  const resendCode = () => {
    setDigits(emptyCode());
    setSecondsLeft(RESEND_SECONDS);
    focusInput(0);
  };

  const isSuccess = phase === "success";

  return (
    <main className="otp-page">
      <section className={`otp-card phase-${phase}`} aria-label="Verification">
        <header className="otp-header">
          <p className="otp-overline">VERIFY IT'S YOU</p>
          <h1 className="otp-title">Enter the 4-digit code</h1>
          <p className="otp-subtext">We sent it to +91 •••• ••412.</p>
        </header>

        <div className="otp-stage">
          <div className="otp-glow" aria-hidden="true" />
          <div className="otp-track" aria-hidden="true" />

          <div className="otp-ring">
            {digits.map((digit, index) => (
              <div className="otp-slot" key={index}>
                <div className={`otp-box${digit ? " is-filled" : ""}`}>
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    className="otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                    value={digit}
                    readOnly={phase !== "idle"}
                    tabIndex={phase === "idle" ? 0 : -1}
                    onChange={(e) => handleChange(index, e)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => handlePaste(index, e)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="otp-core" aria-hidden="true">
            <span className="otp-ripple otp-ripple--one" />
            <span className="otp-ripple otp-ripple--two" />
            <span className="otp-core__icon otp-core__lock">🔒</span>
            <span className="otp-core__icon otp-core__check">✓</span>
          </div>
        </div>

        <div className="otp-footer">
          <p className="otp-footer__slot otp-footer__slot--resend">
            {secondsLeft > 0 ? (
              <span>Resend in {secondsLeft}s</span>
            ) : (
              <button type="button" className="otp-resend" onClick={resendCode}>
                Resend code
              </button>
            )}
          </p>
          <p
            className="otp-footer__slot otp-footer__slot--verifying"
            role="status"
          >
            <span className="otp-pulse">Verifying...</span>
          </p>
        </div>

        <div className="otp-success" aria-hidden={!isSuccess}>
          <p className="otp-item otp-success__tag" style={{ "--d": "0.55s" }}>
            Verified
          </p>
          <h2 className="otp-item otp-success__title" style={{ "--d": "0.75s" }}>
            One code. One you. Welcome in.
          </h2>
          <p className="otp-item otp-success__detail" style={{ "--d": "0.95s" }}>
            <span aria-hidden="true">🔒</span> Verified and secure
          </p>
          <button
            type="button"
            className="otp-item otp-continue"
            style={{ "--d": "1.2s" }}
            tabIndex={isSuccess ? 0 : -1}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </section>

      <button type="button" className="otp-reset" onClick={resetDemo}>
        Reset
      </button>
    </main>
  );
}
