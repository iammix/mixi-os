import React, { useEffect, useState } from 'react';

interface IntroPageProps {
  onStart: () => void;
}

const IntroPage: React.FC<IntroPageProps> = ({ onStart }) => {
  const fullText = "mixi-OS";
  const [displayedText, setDisplayedText] = useState('');
  const [showStartButton, setShowStartButton] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let index = 0;
    let isCancelled = false;

    function typeLetter() {
      if (isCancelled) return;
      if (index < fullText.length - 1) {
        setDisplayedText(prev => prev + fullText[index]);
        index++;
        setTimeout(typeLetter, 100); // typing speed
      } else {
        setTimeout(() => setShowStartButton(true), 500); // 1s delay
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

      <div
        style={{
          ...styles.buttonContainer,
          opacity: showStartButton ? 1 : 0,
          transform: showStartButton ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
          pointerEvents: showStartButton ? 'auto' : 'none',
        }}
      >
        <button
          style={{
            ...styles.button,
            ...(isHovered ? styles.buttonHover : {}),
          }}
          onClick={onStart}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          Start
        </button>
      </div>
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
    position: 'relative',
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
    bottom: '30%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    opacity: 0,
    transform: 'translateY(20px) scale(0.8)',
    transition: 'opacity 1s ease, transform 1s ease',
    pointerEvents: 'none',
  },
  button: {
    backgroundColor: 'black',
    color: 'white',
    fontSize: '1rem',
    padding: '10px 40px',
    cursor: 'pointer',
    borderRadius: 4,
    border: '2px solid white',
    transition: 'all 0.4s ease',
  },
  buttonHover: {
    backgroundColor: 'white',
    color: 'black',
  },
};

// Blinking cursor animation
const styleSheet = document.styleSheets[0];
const keyframes =
  `@keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0; }
    100% { opacity: 1; }
  }`;
styleSheet.insertRule(keyframes, styleSheet.cssRules.length);

export default IntroPage;
