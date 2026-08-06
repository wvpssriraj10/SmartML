import { Route as rootRouteImport }          from './routes/__root.jsx';
import { Route as IndexRouteImport }         from './routes/index.jsx';
import { Route as UploadRouteImport }        from './routes/upload.jsx';
import { Route as UploadsRouteImport }       from './routes/uploads.jsx';
import { Route as CleaningRouteImport }      from './routes/cleaning.jsx';
import { Route as PreviewRouteImport }       from './routes/preview.jsx';
import { Route as TrainingRouteImport }      from './routes/training.jsx';
import { Route as AiInsightsRouteImport }    from './routes/ai-insights.jsx';
import { Route as VisualizationRouteImport } from './routes/visualization.jsx';
import { Route as FeatureAnalysisImport }    from './routes/feature-analysis.jsx';
import { Route as PredictionsRouteImport }   from './routes/predictions.jsx';

const IndexRoute = IndexRouteImport.update({
  id: '/', path: '/',
  getParentRoute: () => rootRouteImport,
});

const UploadRoute = UploadRouteImport.update({
  id: '/upload', path: '/upload',
  getParentRoute: () => rootRouteImport,
});

const UploadsRoute = UploadsRouteImport.update({
  id: '/uploads', path: '/uploads',
  getParentRoute: () => rootRouteImport,
});

const CleaningRoute = CleaningRouteImport.update({
  id: '/cleaning', path: '/cleaning',
  getParentRoute: () => rootRouteImport,
});

const PreviewRoute = PreviewRouteImport.update({
  id: '/preview', path: '/preview',
  getParentRoute: () => rootRouteImport,
});

const TrainingRoute = TrainingRouteImport.update({
  id: '/training', path: '/training',
  getParentRoute: () => rootRouteImport,
});

const AiInsightsRoute = AiInsightsRouteImport.update({
  id: '/ai-insights', path: '/ai-insights',
  getParentRoute: () => rootRouteImport,
});

const VisualizationRoute = VisualizationRouteImport.update({
  id: '/visualization', path: '/visualization',
  getParentRoute: () => rootRouteImport,
});

const FeatureAnalysisRoute = FeatureAnalysisImport.update({
  id: '/feature-analysis', path: '/feature-analysis',
  getParentRoute: () => rootRouteImport,
});

const PredictionsRoute = PredictionsRouteImport.update({
  id: '/predictions', path: '/predictions',
  getParentRoute: () => rootRouteImport,
});

const rootRouteChildren = {
  IndexRoute,
  UploadRoute,
  UploadsRoute,
  CleaningRoute,
  PreviewRoute,
  TrainingRoute,
  AiInsightsRoute,
  VisualizationRoute,
  FeatureAnalysisRoute,
  PredictionsRoute,
};

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren);
