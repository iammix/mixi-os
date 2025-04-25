import React, { useEffect, useState } from 'react';

interface IntroPageProps {
  onStart: () => void;
}

const IntroPage: React.FC<IntroPageProps> = ({ onStart }) => {
  const fullText = "mixi-OS";
  const [displayedText, setDisplayedText] = useState('');
  const [showStartButton, setShowStartButton] = useState(false);

  useEffect(() => {
    let index = 0;
    let isCancelled = false;

    function typeLetter() {
      if (isCancelled) return;
      if (index < fullText.length - 1) {
        setDisplayedText(prev => prev + fullText[index]);
        index++;
        setTimeout(typeLetter, 100);
      } else {
        setTimeout(() => setShowStartButton(true), 500);
      }
    }

    typeLetter();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.textBox}>
        <h1 style={styles.typing}>
          {displayedText}
          <span style={styles.cursor}>|</span>
        </h1>
      </div>

      {showStartButton && (
        <div style={styles.buttonContainer}>
          <button style={styles.button} onClick={onStart}>
            Start
          </button>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100vw',
    height: '100vh',
    backgroundColor: 'black',
    color: 'white',
    fontFamily: 'Courier New, monospace',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // Needed for the absolute button
    overflow: 'hidden',
  },
  textBox: {
    textAlign: 'center',
    zIndex: 2,
  },
  typing: {
    fontSize: '2rem',
    marginBottom: '2rem',
    minHeight: '3rem',
  },
  cursor: {
    display: 'inline-block',
    width: '10px',
    animation: 'blink 1s infinite',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: '10%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: 'black',
    color: 'white',
    fontSize: '2rem',
    padding: '50px 20px',
    cursor: 'pointer',
    borderRadius: 4,
    border: '2px solid white',
  },
};

// Inject blinking cursor animation once
const styleSheet = document.styleSheets[0];
const keyframes =
  `@keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0; }
    100% { opacity: 1; }
  }`;
styleSheet.insertRule(keyframes, styleSheet.cssRules.length);

export default IntroPage;
