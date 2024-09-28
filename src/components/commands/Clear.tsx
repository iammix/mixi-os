import { useContext, useEffect } from "react";
import { UsageDiv } from "../styles/Output.styled";
import { termContext } from "../apps/terminal-components/Terminal";
import React from 'react';

const Clear: React.FC = () => {
  const { arg, clearHistory } = useContext(termContext);
  useEffect(() => {
    if (arg.length < 1) clearHistory?.();
  }, []);
  return arg.length > 0 ? <UsageDiv>Usage: clear</UsageDiv> : <></>;
};

export default Clear;
