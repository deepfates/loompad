import Interface from "./interface/Interface";
import PersistentStoryRoutes from "./interface/persistent/PersistentStoryRoutes";
import { Router, Switch, Route } from "wouter";
import { default as SrclProvider } from "srcl/components/Providers.tsx";

function App() {
  return (
    <SrclProvider>
      <Router>
        <Switch>
          <Route path="/stories/:storyId/:nodeId">
            {(params) => (
              <PersistentStoryRoutes
                storyId={params.storyId}
                nodeId={params.nodeId}
              />
            )}
          </Route>
          <Route path="/stories/:storyId">
            {(params) => <PersistentStoryRoutes storyId={params.storyId} />}
          </Route>
          <Route path="/">
            <Interface />
          </Route>
          <Route>
            <PersistentStoryRoutes />
          </Route>
        </Switch>
      </Router>
    </SrclProvider>
  );
}

export default App;
