import Interface from "./interface/Interface";
import { default as SrclProvider } from "srcl/components/Providers.tsx";

function App() {
  return (
    <SrclProvider>
      <Interface />
    </SrclProvider>
  );
}

export default App;
