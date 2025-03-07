import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import partition from 'lodash/partition';

import HighlightTopRight from 'sentry-images/pattern/highlight-top-right.svg';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import type {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {taskIsDone} from 'sentry/components/onboardingWizard/utils';
import ProgressRing from 'sentry/components/progressRing';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconCheckmark,
  IconChevron,
  IconClose,
  IconNot,
  IconSupport,
  IconSync,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import {space} from 'sentry/styles/space';
import {type OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import useApi from 'sentry/utils/useApi';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

const orderedGettingStartedTasks = [
  OnboardingTaskKey.FIRST_PROJECT,
  OnboardingTaskKey.FIRST_EVENT,
  OnboardingTaskKey.INVITE_MEMBER,
  OnboardingTaskKey.ALERT_RULE,
  OnboardingTaskKey.SOURCEMAPS,
  OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
  OnboardingTaskKey.RELEASE_TRACKING,
];

const orderedBeyondBasicsTasks = [
  OnboardingTaskKey.REAL_TIME_NOTIFICATIONS,
  OnboardingTaskKey.SESSION_REPLAY,
  OnboardingTaskKey.FIRST_TRANSACTION,
  OnboardingTaskKey.SECOND_PLATFORM,
];

function groupTasksByCompletion(tasks: OnboardingTask[]) {
  const [completedTasks, incompletedTasks] = partition(tasks, task => taskIsDone(task));
  return {
    completedTasks,
    incompletedTasks,
  };
}

interface TaskCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

function TaskCard({
  description,
  icon,
  title,
  actions,
  onClick,
  className,
}: TaskCardProps) {
  return (
    <TaskCardWrapper
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={className}
    >
      {onClick && <InteractionStateLayer />}
      <TaskCardIcon>{icon}</TaskCardIcon>
      <TaskCardDescription>
        {title}
        {description && <p>{description}</p>}
      </TaskCardDescription>
      <TaskCardActions>{actions}</TaskCardActions>
    </TaskCardWrapper>
  );
}

interface TaskStatusIconProps {
  status: 'complete' | 'inProgress' | 'skipped' | 'pending';
  progress?: number;
  tooltipText?: string;
}

function TaskStatusIcon({status, tooltipText, progress}: TaskStatusIconProps) {
  const theme = useTheme();

  const progressValue = progress ?? 0;

  return (
    <Tooltip title={tooltipText} disabled={!tooltipText} containerDisplayMode="flex">
      {status === 'complete' ? (
        <IconCheckmark
          css={css`
            color: ${theme.success};
            height: ${theme.fontSizeLarge};
            width: ${theme.fontSizeLarge};
          `}
          isCircled
        />
      ) : status === 'skipped' ? (
        <IconNot
          css={css`
            color: ${theme.disabled};
            height: ${theme.fontSizeLarge};
            width: ${theme.fontSizeLarge};
          `}
        />
      ) : status === 'pending' ? (
        <IconSync // TODO(Telemetry): Remove pending status
          css={css`
            color: ${theme.pink400};
            height: ${theme.fontSizeLarge};
            width: ${theme.fontSizeLarge};
          `}
        />
      ) : (
        <ProgressRing
          value={progressValue * 100}
          progressEndcaps="round"
          size={16}
          barWidth={2}
        />
      )}
    </Tooltip>
  );
}

interface SkipConfirmationProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

function SkipConfirmation({onConfirm, onDismiss}: SkipConfirmationProps) {
  const organization = useOrganization();
  const theme = useTheme();

  return (
    <SkipConfirmationWrapper>
      <TaskCard
        title={t('Not sure what to do? We’re here for you!')}
        icon={
          <IconChevron
            direction="up"
            css={css`
              color: ${theme.disabled};
              height: ${theme.fontSizeLarge};
              width: ${theme.fontSizeLarge};
            `}
            isCircled
          />
        }
        actions={
          <Fragment>
            <Button
              borderless
              size="zero"
              aria-label={t('Just Skip')}
              title={t('Just Skip')}
              icon={<IconClose color="gray300" isCircled />}
              onClick={event => {
                event.stopPropagation();
                onConfirm();
              }}
            />
            <DropdownMenu
              position="top-start"
              triggerProps={{
                'aria-label': t('Help'),
                title: t('Help'),
                icon: <IconSupport color="gray300" />,
                showChevron: false,
                size: 'zero',
                borderless: true,
              }}
              items={[
                {
                  key: 'search',
                  label: t('Search Support, Docs and More'),
                  onAction() {
                    openHelpSearchModal({organization});
                  },
                },
                {
                  key: 'help',
                  label: t('Visit Help Center'),
                  // TODO(Telemetry): Make it open in a new tab
                  to: 'https://sentry.zendesk.com/hc/en-us',
                },
                {
                  key: 'discord',
                  label: t('Join our Discord'),
                  to: 'https://discord.com/invite/sentry',
                },
                {
                  key: 'support',
                  label: t('Contact Support'),
                  to: `mailto:${ConfigStore.get('supportEmail')}`,
                },
              ]}
            />
            <Button
              borderless
              size="zero"
              aria-label={t('Dismiss Skip')}
              title={t('Dismiss Skip')}
              icon={<IconClose color="gray300" />}
              onClick={event => {
                event.stopPropagation();
                onDismiss();
              }}
            />
          </Fragment>
        }
      />
    </SkipConfirmationWrapper>
  );
}

interface TaskProps {
  hidePanel: () => void;
  task: OnboardingTask;
  completed?: boolean;
  showWaitingIndicator?: boolean;
}

function Task({task, hidePanel, showWaitingIndicator}: TaskProps) {
  const api = useApi();
  const organization = useOrganization();
  const router = useRouter();
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      trackAnalytics('quick_start.task_card_clicked', {
        organization,
        todo_id: task.task,
        todo_title: task.title,
        action: 'clickthrough',
        new_experience: true,
      });

      e.stopPropagation();

      if (isDemoModeEnabled()) {
        DemoWalkthroughStore.activateGuideAnchor(task.task);
      }

      if (task.actionType === 'external') {
        window.open(task.location, '_blank');
      }

      if (task.actionType === 'action') {
        task.action(router);
      }

      if (task.actionType === 'app') {
        // Convert all paths to a location object
        let to =
          typeof task.location === 'string' ? {pathname: task.location} : task.location;
        // Add referrer to all links
        to = {...to, query: {...to.query, referrer: 'onboarding_task'}};

        navigateTo(to, router);
      }
      hidePanel();
    },
    [task, organization, router, hidePanel]
  );

  const handleMarkSkipped = useCallback(
    (taskKey: OnboardingTaskKey) => {
      trackAnalytics('quick_start.task_card_clicked', {
        organization,
        todo_id: task.task,
        todo_title: task.title,
        action: 'skipped',
        new_experience: true,
      });
      updateOnboardingTask(api, organization, {
        task: taskKey,
        status: 'skipped',
        completionSeen: true,
      });
    },
    [task, organization, api]
  );

  const iconTooltipText = useMemo(() => {
    switch (task.status) {
      case 'complete':
        return t('Task completed');
      case 'pending':
        return task.pendingTitle ?? t('Task in progress\u2026');
      case 'skipped':
        return t('Task skipped');
      default:
        return undefined;
    }
  }, [task.status, task.pendingTitle]);

  return (
    <TaskWrapper>
      <TaskCard
        onClick={
          task.status === 'complete' || task.status === 'skipped'
            ? undefined
            : handleClick
        }
        icon={<TaskStatusIcon status={task.status} tooltipText={iconTooltipText} />}
        description={task.description}
        title={<strong>{task.title}</strong>}
        actions={
          task.status === 'complete' || task.status === 'skipped'
            ? undefined
            : task.requisiteTasks.length === 0 && (
                <TaskActions>
                  {task.skippable && (
                    <Button
                      borderless
                      size="zero"
                      aria-label={t('Skip Task')}
                      title={t('Skip Task')}
                      icon={<IconClose color="gray300" isCircled />}
                      onClick={event => {
                        event.stopPropagation();
                        setShowSkipConfirmation(!showSkipConfirmation);
                      }}
                      css={css`
                        /* If the pulsing indicator is active, the close button
                        * should be above it so it's clickable.
                        */
                        z-index: 1;
                      `}
                    />
                  )}
                  {task.SupplementComponent && showWaitingIndicator && (
                    <task.SupplementComponent task={task} />
                  )}
                </TaskActions>
              )
        }
      />
      {showSkipConfirmation && (
        <SkipConfirmation
          onConfirm={() => handleMarkSkipped(task.task)}
          onDismiss={() => setShowSkipConfirmation(false)}
        />
      )}
    </TaskWrapper>
  );
}

interface TaskGroupProps {
  /**
   * Used for analytics
   */
  group: 'getting_started' | 'beyond_basics';
  hidePanel: () => void;
  taskKeyForWaitingIndicator: OnboardingTaskKey | undefined;
  tasks: OnboardingTask[];
  title: string;
  expanded?: boolean;
  toggleable?: boolean;
}

function TaskGroup({
  title,
  tasks,
  expanded,
  hidePanel,
  taskKeyForWaitingIndicator,
  toggleable = true,
  group,
}: TaskGroupProps) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(expanded);
  const {completedTasks, incompletedTasks} = groupTasksByCompletion(tasks);
  const [taskGroupComplete, setTaskGroupComplete] = useLocalStorageState(
    `quick-start:${organization.slug}:${group}-completed`,
    false
  );

  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    if (completedTasks.length !== tasks.length || taskGroupComplete) {
      return;
    }

    trackAnalytics('quick_start.task_group_completed', {
      organization,
      group,
    });

    setTaskGroupComplete(true);
  }, [
    group,
    organization,
    completedTasks,
    tasks,
    setTaskGroupComplete,
    taskGroupComplete,
  ]);

  return (
    <TaskGroupWrapper>
      <TaskGroupHeader
        title={<strong>{title}</strong>}
        description={
          tasks.length > 1
            ? tct('[totalCompletedTasks] out of [totalTasks] tasks completed', {
                totalCompletedTasks: completedTasks.length,
                totalTasks: tasks.length,
              })
            : tct('[totalCompletedTasks] out of [totalTasks] task completed', {
                totalCompletedTasks: completedTasks.length,
                totalTasks: tasks.length,
              })
        }
        hasProgress={completedTasks.length > 0}
        onClick={toggleable ? () => setIsExpanded(!isExpanded) : undefined}
        icon={
          <TaskStatusIcon
            status={completedTasks.length === tasks.length ? 'complete' : 'inProgress'}
            progress={completedTasks.length / tasks.length}
          />
        }
        actions={
          <Button
            icon={<Chevron direction={isExpanded ? 'up' : 'down'} />}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            aria-expanded={isExpanded}
            size="zero"
            borderless
          />
        }
      />
      {isExpanded && (
        <Fragment>
          <hr />
          <TaskGroupBody>
            {incompletedTasks.map(task => (
              <Task
                key={task.task}
                task={task}
                hidePanel={hidePanel}
                showWaitingIndicator={taskKeyForWaitingIndicator === task.task}
              />
            ))}
            {completedTasks.map(task => (
              <Task key={task.task} task={task} hidePanel={hidePanel} />
            ))}
          </TaskGroupBody>
        </Fragment>
      )}
    </TaskGroupWrapper>
  );
}

interface NewSidebarProps
  extends Pick<CommonSidebarProps, 'orientation' | 'collapsed'>,
    Pick<
      ReturnType<typeof useOnboardingTasks>,
      'gettingStartedTasks' | 'beyondBasicsTasks'
    > {
  onClose: () => void;
}

export function NewOnboardingSidebar({
  onClose,
  orientation,
  collapsed,
  gettingStartedTasks,
  beyondBasicsTasks,
}: NewSidebarProps) {
  const walkthrough = isDemoModeEnabled();

  const sortedGettingStartedTasks = gettingStartedTasks.sort(
    (a, b) =>
      orderedGettingStartedTasks.indexOf(a.task) -
      orderedGettingStartedTasks.indexOf(b.task)
  );

  const sortedBeyondBasicsTasks = beyondBasicsTasks.sort(
    (a, b) =>
      orderedBeyondBasicsTasks.indexOf(a.task) - orderedBeyondBasicsTasks.indexOf(b.task)
  );

  const taskKeyForWaitingIndicator = useMemo(() => {
    return [...sortedGettingStartedTasks, ...sortedBeyondBasicsTasks].find(
      task => !taskIsDone(task) && !!task.SupplementComponent
    )?.task;
  }, [sortedGettingStartedTasks, sortedBeyondBasicsTasks]);

  return (
    <Wrapper
      collapsed={collapsed}
      hidePanel={onClose}
      orientation={orientation}
      title={walkthrough ? t('Guided Tour') : t('Quick Setup')}
    >
      <Content>
        <TaskGroup
          title={t('Getting Started')}
          tasks={sortedGettingStartedTasks}
          hidePanel={onClose}
          expanded={
            groupTasksByCompletion(sortedGettingStartedTasks).incompletedTasks.length > 0
          }
          toggleable={sortedBeyondBasicsTasks.length > 0}
          taskKeyForWaitingIndicator={taskKeyForWaitingIndicator}
          group="getting_started"
        />
        {sortedBeyondBasicsTasks.length > 0 && (
          <TaskGroup
            title={t('Beyond the Basics')}
            tasks={sortedBeyondBasicsTasks}
            hidePanel={onClose}
            expanded={
              groupTasksByCompletion(sortedGettingStartedTasks).incompletedTasks
                .length === 0 &&
              groupTasksByCompletion(sortedBeyondBasicsTasks).incompletedTasks.length > 0
            }
            taskKeyForWaitingIndicator={taskKeyForWaitingIndicator}
            group="beyond_basics"
          />
        )}
      </Content>
      <BottomLeft src={HighlightTopRight} />
    </Wrapper>
  );
}

const Wrapper = styled(SidebarPanel)`
  width: 100%;
  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    width: 460px;
  }
`;

const Content = styled('div')`
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  flex: 1;

  p {
    margin-bottom: ${space(1)};
  }
`;

const TaskGroupWrapper = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};

  hr {
    border-color: ${p => p.theme.translucentBorder};
    margin: ${space(1)} -${space(1)};
  }
`;

const TaskGroupHeader = styled(TaskCard)<{hasProgress: boolean}>`
  p {
    color: ${p => (p.hasProgress ? p.theme.successText : p.theme.subText)};
  }
`;

const TaskGroupBody = styled(motion.ul)`
  border-radius: ${p => p.theme.borderRadius};
  list-style-type: none;
  padding: 0;
  margin: 0;
`;

const TaskWrapper = styled(motion.li)`
  gap: ${space(1)};
`;

const TaskActions = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
`;

const BottomLeft = styled('img')`
  width: 60%;
  transform: rotate(180deg);
  margin-top: ${space(3)};
`;

const TaskCardWrapper = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1.5)};
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1.5)};
  p {
    margin: 0;
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;

const TaskCardDescription = styled('div')`
  line-height: 20px;
`;

const TaskCardIcon = styled('div')`
  display: flex;
  align-items: center;
  height: 20px;
`;

const TaskCardActions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 20px;
  gap: ${space(1)};
  align-items: flex-start;
`;

const SkipConfirmationWrapper = styled('div')`
  margin: ${space(1)} 0;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
