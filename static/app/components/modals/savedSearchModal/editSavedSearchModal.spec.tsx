import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {EditSavedSearchModal} from 'sentry/components/modals/savedSearchModal/editSavedSearchModal';
import {SavedSearchType, SavedSearchVisibility} from 'sentry/types/group';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('EditSavedSearchModal', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
  });

  const defaultProps = {
    Body: ModalBody,
    Header: makeClosableHeader(jest.fn()),
    Footer: ModalFooter,
    CloseButton: makeCloseButton(jest.fn()),
    closeModal: jest.fn(),
    organization: OrganizationFixture(),
    savedSearch: {
      id: 'saved-search-id',
      name: 'Saved search name',
      query: 'is:unresolved browser:firefox',
      sort: IssueSortOptions.DATE,
      visibility: SavedSearchVisibility.OWNER,
      dateCreated: '',
      isPinned: false,
      isGlobal: false,
      type: SavedSearchType.ISSUE,
    },
  };

  it('can edit a saved search with org:write', async function () {
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/saved-search-id/',
      method: 'PUT',
      body: {
        id: 'saved-search-id',
        name: 'test',
        query: 'is:unresolved browser:firefox event.type:error',
        sort: IssueSortOptions.TRENDS,
        visibility: SavedSearchVisibility.OWNER,
      },
    });

    render(<EditSavedSearchModal {...defaultProps} />);

    await userEvent.clear(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');

    await selectEvent.select(screen.getByText('Last Seen'), 'Trends');

    await userEvent.click(
      screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)!
    );
    await userEvent.paste('event.type:error');

    await selectEvent.select(screen.getByText('Only me'), 'Users in my organization');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(editMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/saved-search-id/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            query: 'is:unresolved browser:firefox event.type:error',
            visibility: SavedSearchVisibility.ORGANIZATION,
          }),
        })
      );
    });
  });

  it('can edit a saved search without org:write', async function () {
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/saved-search-id/',
      method: 'PUT',
      body: {
        id: 'saved-search-id',
        name: 'test',
        query: 'is:unresolved browser:firefox',
        sort: IssueSortOptions.TRENDS,
        visibility: SavedSearchVisibility.OWNER,
      },
    });

    render(
      <EditSavedSearchModal
        {...defaultProps}
        organization={OrganizationFixture({
          access: [],
        })}
      />
    );

    await userEvent.clear(screen.getByRole('textbox', {name: /name/i}));
    await userEvent.paste('new search name');

    // Hovering over the visibility dropdown shows disabled reason
    await userEvent.hover(screen.getByText(/only me/i));
    await screen.findByText(/only organization admins can create global saved searches/i);

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(editMock).toHaveBeenCalledWith(
        '/organizations/org-slug/searches/saved-search-id/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new search name',
            query: 'is:unresolved browser:firefox',
            visibility: SavedSearchVisibility.OWNER,
          }),
        })
      );
    });
  });
});
