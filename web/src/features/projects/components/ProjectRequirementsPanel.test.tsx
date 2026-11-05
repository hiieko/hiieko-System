import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleContext } from '@solar/shared';
import { ProjectRequirementsPanel } from './ProjectRequirementsPanel';

jest.mock('../requirements-api', () => ({
  getProjectRequirements: jest.fn(),
  getProjectRequirementHistory: jest.fn(),
  getProjectCatalogAdoptions: jest.fn(),
  assessProjectRequirement: jest.fn(),
  adoptLatestProjectCatalog: jest.fn(),
  initializeProjectFolders: jest.fn(),
}));

import {
  adoptLatestProjectCatalog,
  initializeProjectFolders,
  assessProjectRequirement,
  getProjectCatalogAdoptions,
  getProjectRequirementHistory,
  getProjectRequirements,
} from '../requirements-api';

const requirementsApi = {
  getProjectRequirements: getProjectRequirements as jest.Mock,
  getProjectRequirementHistory: getProjectRequirementHistory as jest.Mock,
  getProjectCatalogAdoptions: getProjectCatalogAdoptions as jest.Mock,
  assessProjectRequirement: assessProjectRequirement as jest.Mock,
  adoptLatestProjectCatalog: adoptLatestProjectCatalog as jest.Mock,
  initializeProjectFolders: initializeProjectFolders as jest.Mock,
};

const requirementResponse = {
  data: {
    initialized: true,
    projectType: 'RESIDENTIAL_SOLAR',
    catalogVersion: { id: 'catalog-v1', version: 1, displayName: 'Requirements v1' },
    canAssess: true,
    canAdopt: true,
    canInitializeFolders: false,
    requirements: [{
      id: 'project-requirement-1',
      definitionId: 'definition-1',
      requirementKey: 'SITE_PLAN',
      description: 'Approved site plan',
      projectType: 'RESIDENTIAL_SOLAR',
      state: 'NOT_ASSESSED',
      assessments: [],
    }],
  },
};

function renderPanel(onProjectUpdated = jest.fn()) {
  return {
    onProjectUpdated,
    ...render(
      <LocaleContext.Provider value={{ locale: 'en', setLocale: jest.fn() }}>
        <ProjectRequirementsPanel
          projectId="project-1"
          projectType="RESIDENTIAL_SOLAR"
          onProjectUpdated={onProjectUpdated}
        />
      </LocaleContext.Provider>,
    ),
  };
}

describe('ProjectRequirementsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirementsApi.getProjectRequirements.mockResolvedValue(requirementResponse);
    requirementsApi.getProjectRequirementHistory.mockResolvedValue({ data: [] });
    requirementsApi.getProjectCatalogAdoptions.mockResolvedValue({ data: [] });
    requirementsApi.assessProjectRequirement.mockResolvedValue({ data: { changed: true } });
    requirementsApi.adoptLatestProjectCatalog.mockResolvedValue({ data: { adoption: { id: 'adoption-1' } } });
    requirementsApi.initializeProjectFolders.mockResolvedValue({ data: { projectId: 'project-1', foldersCreated: 2, alreadyInitialized: false } });
  });

  it('shows the pinned applicable requirements and offers only assessed decision states', async () => {
    renderPanel();

    expect(await screen.findByText('Approved site plan')).toBeInTheDocument();
    expect(screen.getByText(/Requirements v1/)).toBeInTheDocument();
    expect(screen.getByText('Not assessed')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Not assessed' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Applicable' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not applicable' })).toBeInTheDocument();
  });

  it('submits an assessment reason and decision to the backend', async () => {
    renderPanel();
    await screen.findByText('Approved site plan');

    fireEvent.change(screen.getByLabelText('Decision: SITE_PLAN'), { target: { value: 'APPLICABLE' } });
    fireEvent.change(screen.getByLabelText('Assessment reason: SITE_PLAN'), { target: { value: 'Evidence reviewed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    });

    await waitFor(() => expect(requirementsApi.assessProjectRequirement).toHaveBeenCalledWith(
      'project-1',
      'project-requirement-1',
      { state: 'APPLICABLE', note: 'Evidence reviewed' },
    ));
  });

  it('submits an explicit type and reason for latest-catalog adoption', async () => {
    const onProjectUpdated = jest.fn();
    renderPanel(onProjectUpdated);
    await screen.findByText('Approved site plan');

    fireEvent.change(screen.getByLabelText('Project type'), { target: { value: 'COMMERCIAL_SOLAR' } });
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Project scope reviewed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Adopt latest published version' }));
    });

    await waitFor(() => expect(requirementsApi.adoptLatestProjectCatalog).toHaveBeenCalledWith(
      'project-1',
      { projectType: 'COMMERCIAL_SOLAR', reason: 'Project scope reviewed' },
    ));
    expect(onProjectUpdated).toHaveBeenCalled();
  });

  it('shows the explicit initialization action only when the backend grants it', async () => {
    requirementsApi.getProjectRequirements.mockResolvedValue({
      data: {
        ...requirementResponse.data,
        canInitializeFolders: true,
      },
    });
    renderPanel();
    await screen.findByText('Approved site plan');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Initialize project folders' }));
    });
    await waitFor(() => expect(requirementsApi.initializeProjectFolders).toHaveBeenCalledWith('project-1'));
  });
});
