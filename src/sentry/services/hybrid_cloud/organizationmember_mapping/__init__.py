# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime
from typing import Optional, cast

from django.utils import timezone
from pydantic.fields import Field

from sentry.models import OrganizationMember
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class RpcOrganizationMemberMapping(RpcModel):
    organizationmember_id: int = -1
    organization_id: int = -1
    date_added: datetime = Field(default_factory=timezone.now)

    role: str = ""
    user_id: Optional[int] = None
    email: Optional[str] = None
    inviter_id: Optional[int] = None
    invite_status: Optional[int] = None


class RpcOrganizationMemberMappingUpdate(RpcModel):
    """
    A set of values to be updated on an OrganizationMemberMapping.

    An omitted key indicates that the attribute should not be updated. (Compare to a
    `"user_id": None` entry, which indicates that `user_id` should be
    overwritten with a null value.)
    """

    role: str
    user_id: Optional[int]
    email: Optional[str]
    inviter_id: Optional[int]
    invite_status: Optional[int]

    @classmethod
    def from_orm(
        cls, organization_member: OrganizationMember
    ) -> "RpcOrganizationMemberMappingUpdate":
        attributes = {
            attr_name: getattr(organization_member, attr_name)
            for attr_name in RpcOrganizationMemberMappingUpdate.__annotations__.keys()
        }
        return RpcOrganizationMemberMappingUpdate(**attributes)


class OrganizationMemberMappingService(RpcService):
    key = "organizationmember_mapping"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organizationmember_mapping.impl import (
            DatabaseBackedOrganizationMemberMappingService,
        )

        return DatabaseBackedOrganizationMemberMappingService()

    @rpc_method
    @abstractmethod
    def create_mapping(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
        role: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        inviter_id: Optional[int] = None,
        invite_status: Optional[int] = None,
    ) -> RpcOrganizationMemberMapping:
        pass

    @rpc_method
    @abstractmethod
    def create_with_organization_member(
        self, *, org_member: OrganizationMember
    ) -> RpcOrganizationMemberMapping:
        pass

    @rpc_method
    @abstractmethod
    def update_with_organization_member(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
        rpc_update_org_member: RpcOrganizationMemberMappingUpdate,
    ) -> RpcOrganizationMemberMapping:
        pass

    @rpc_method
    @abstractmethod
    def delete_with_organization_member(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
    ) -> None:
        pass


def impl_with_db() -> OrganizationMemberMappingService:
    from sentry.services.hybrid_cloud.organizationmember_mapping.impl import (
        DatabaseBackedOrganizationMemberMappingService,
    )

    return DatabaseBackedOrganizationMemberMappingService()


organizationmember_mapping_service: OrganizationMemberMappingService = cast(
    OrganizationMemberMappingService, OrganizationMemberMappingService.create_delegation()
)
